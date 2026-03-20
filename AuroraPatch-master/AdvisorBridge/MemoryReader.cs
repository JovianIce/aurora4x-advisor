using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using System.Windows.Forms;
using HarmonyLib;

namespace AdvisorBridge
{
    /// <summary>
    /// Reads Aurora game objects directly from memory via cached reflection.
    /// All field names reference obfuscated Aurora types (checksum OdxONo).
    /// See project_memory_mapping.md for the complete field-to-DB-column mapping.
    ///
    /// Type mapping:
    ///   a0 = GameState       | kc = SystemBody    | jo = Star
    ///   js = StarSystem       | kd = StarDetails   | jq = SystemNameRecord
    ///
    /// GameState collection mapping:
    ///   bw = Dict[int, SystemBody]       (3539 bodies)
    ///   bv = Dict[int, Star]             (50 stars)
    ///   bu = Dict[int, StarSystem]       (37 systems)
    ///   b2 = Dict[int, SystemNameRecord] (63593 name records)
    /// </summary>
    public class MemoryReader
    {
        private readonly Lib.Lib _lib;
        private readonly AuroraPatch.Patch _patch;

        #region Cached Reflection Fields

        // GameState access: TacticalMap -> GameState
        private FieldInfo _gameStateField;

        // SystemBody (kc) - GameState.bw
        private FieldInfo _systemBodiesDict;
        private FieldInfo[] _systemBodyAllFields;
        private FieldInfo _systemBodySystemIdField;     // kc.w = SystemID

        // Star (jo) - GameState.bv
        private FieldInfo _starsDict;
        private FieldInfo[] _starAllFields;
        private FieldInfo _starIdField;                 // jo.f = StarID
        private FieldInfo _starParentField;             // jo.b = parent star ref
        private FieldInfo _starDetailsField;            // jo.c = StarDetails (kd) ref
        private FieldInfo _starSystemRefField;          // jo.a = StarSystem (js) ref
        private FieldInfo _starSystemIdField;           // jo.g = SystemID

        // StarDetails (kd) - accessed via Star.c
        private FieldInfo[] _starDetailsAllFields;

        // StarSystem (js) - GameState.bu
        private FieldInfo _starSystemsDict;
        private FieldInfo[] _starSystemAllFields;
        private FieldInfo _starSystemIdFieldOnJs;       // js.g = SystemID

        // SystemNameRecord (jq) - GameState.b2
        private FieldInfo _systemNameRecordsDict;
        private FieldInfo _systemNameSystemIdField;     // jq.b = SystemID
        private FieldInfo _systemNameField;             // jq.q = Name

        // Fleet (f4) - GameState.bm
        private FieldInfo _fleetsDict;
        private FieldInfo[] _fleetAllFields;
        private FieldInfo _fleetIdField;              // f4.ae = FleetID
        private FieldInfo _fleetNameField;            // f4.b1 = FleetName
        private FieldInfo _fleetSpeedField;           // f4.ah = Speed
        private FieldInfo _fleetXcorField;            // f4.ap = Xcor
        private FieldInfo _fleetYcorField;            // f4.aq = Ycor
        private FieldInfo _fleetRaceRefField;         // f4.h = ref:ag (Race), sub-field ck=RaceID
        private FieldInfo _fleetCivilianField;        // f4.ay = IsCivilian (bool)
        private FieldInfo _fleetNavField;             // f4.i = ref:jx (navigation), sub-field ac=SystemName

        // Ship (a2) - GameState.bp
        private FieldInfo _shipsDict;
        private FieldInfo _shipIdField;               // a2.bf = ShipID
        private FieldInfo _shipNameField;             // a2.d9 = ShipName
        private FieldInfo _shipFuelField;             // a2.ca = Fuel

        // Fast-read cache: only fields needed for rendering
        private FieldInfo[] _bodyFastFields;
        private string[] _bodyFastFieldNames;

        private bool _initialized;
        private bool _initFailed;

        #endregion

        public MemoryReader(Lib.Lib lib, AuroraPatch.Patch patch)
        {
            _lib = lib;
            _patch = patch;
        }

        #region Initialization

        private bool Initialize()
        {
            if (_initialized) return !_initFailed;
            _initialized = true;

            try
            {
                var map = _lib.TacticalMap;
                if (map == null) { _initFailed = true; return false; }

                var gameStateType = _lib.SignatureManager.Get(Lib.AuroraType.GameState);
                if (gameStateType == null) { _initFailed = true; return false; }

                // Find GameState field on TacticalMap (first field matching GameState type)
                foreach (var f in map.GetType().GetFields(AccessTools.all))
                {
                    if (f.FieldType == gameStateType) { _gameStateField = f; break; }
                }
                if (_gameStateField == null) { _initFailed = true; return false; }

                InitStarFields(gameStateType);
                InitStarSystemFields(gameStateType);
                InitSystemNameFields(gameStateType);
                InitSystemBodyFields(gameStateType);
                InitFleetFields(gameStateType);
                InitShipFields(gameStateType);

                _patch.LogInfo($"MemoryReader initialized: Star={_starAllFields?.Length ?? 0}, " +
                    $"SystemBody={_systemBodyAllFields?.Length ?? 0}, " +
                    $"StarSystem={_starSystemAllFields?.Length ?? 0}, " +
                    $"Fleet={_fleetAllFields?.Length ?? 0}, Ship={_shipIdField != null}");
                return true;
            }
            catch (Exception ex)
            {
                _patch.LogError($"MemoryReader init failed: {ex.Message}");
                _initFailed = true;
                return false;
            }
        }

        private void InitStarFields(Type gameStateType)
        {
            // Stars: GameState.bv -> Dict<int, Star(jo)>
            _starsDict = gameStateType.GetField("bv", AccessTools.all);
            if (_starsDict == null) return;

            var starType = _starsDict.FieldType.GenericTypeArguments[1];
            _starAllFields = starType.GetFields(AccessTools.all);
            _starIdField = starType.GetField("f", AccessTools.all);
            _starParentField = starType.GetField("b", AccessTools.all);
            _starDetailsField = starType.GetField("c", AccessTools.all);
            _starSystemRefField = starType.GetField("a", AccessTools.all);
            _starSystemIdField = starType.GetField("g", AccessTools.all);

            // StarDetails (kd) - accessed from Star.c
            if (_starDetailsField != null)
                _starDetailsAllFields = _starDetailsField.FieldType.GetFields(AccessTools.all);

            // StarSystem fields (js) - accessed from Star.a
            if (_starSystemRefField != null)
                _starSystemAllFields = _starSystemRefField.FieldType.GetFields(AccessTools.all);
        }

        private void InitStarSystemFields(Type gameStateType)
        {
            // StarSystems: GameState.bu -> Dict<int, StarSystem(js)>
            _starSystemsDict = gameStateType.GetField("bu", AccessTools.all);
            if (_starSystemsDict == null) return;

            var starSystemType = _starSystemsDict.FieldType.GenericTypeArguments[1];
            _starSystemIdFieldOnJs = starSystemType.GetField("g", AccessTools.all);
        }

        private void InitSystemNameFields(Type gameStateType)
        {
            // SystemNameRecords: GameState.b2 -> Dict<int, SystemNameRecord(jq)>
            _systemNameRecordsDict = gameStateType.GetField("b2", AccessTools.all);
            if (_systemNameRecordsDict == null) return;

            var nameRecordType = _systemNameRecordsDict.FieldType.GenericTypeArguments[1];
            _systemNameSystemIdField = nameRecordType.GetField("b", AccessTools.all);
            _systemNameField = nameRecordType.GetField("q", AccessTools.all);
        }

        private void InitSystemBodyFields(Type gameStateType)
        {
            // SystemBodies: GameState.bw -> Dict<int, SystemBody(kc)>
            _systemBodiesDict = gameStateType.GetField("bw", AccessTools.all);
            if (_systemBodiesDict == null) return;

            var bodyType = _systemBodiesDict.FieldType.GenericTypeArguments[1];
            _systemBodyAllFields = bodyType.GetFields(AccessTools.all);
            _systemBodySystemIdField = bodyType.GetField("w", AccessTools.all);
            _patch.LogInfo($"MemoryReader: SystemBody type has {_systemBodyAllFields.Length} fields");
        }

        private void InitFleetFields(Type gameStateType)
        {
            // Fleets: GameState.bm -> Dict<int, Fleet(f4)>
            _fleetsDict = gameStateType.GetField("bm", AccessTools.all);
            if (_fleetsDict == null) return;

            var fleetType = _fleetsDict.FieldType.GenericTypeArguments[1];
            _fleetAllFields = fleetType.GetFields(AccessTools.all);
            _fleetIdField = fleetType.GetField("ae", AccessTools.all);
            _fleetNameField = fleetType.GetField("b1", AccessTools.all);
            _fleetSpeedField = fleetType.GetField("ah", AccessTools.all);
            _fleetXcorField = fleetType.GetField("ap", AccessTools.all);
            _fleetYcorField = fleetType.GetField("aq", AccessTools.all);
            _fleetRaceRefField = fleetType.GetField("h", AccessTools.all);
            _fleetCivilianField = fleetType.GetField("ay", AccessTools.all);
            _fleetNavField = fleetType.GetField("i", AccessTools.all);

            _patch.LogInfo($"MemoryReader: Fleet type has {_fleetAllFields.Length} fields");
        }

        private void InitShipFields(Type gameStateType)
        {
            // Ships: GameState.bp -> Dict<int, Ship(a2)>
            _shipsDict = gameStateType.GetField("bp", AccessTools.all);
            if (_shipsDict == null) return;

            var shipType = _shipsDict.FieldType.GenericTypeArguments[1];
            _shipIdField = shipType.GetField("bf", AccessTools.all);
            _shipNameField = shipType.GetField("d9", AccessTools.all);
            _shipFuelField = shipType.GetField("ca", AccessTools.all);

            _patch.LogInfo($"MemoryReader: Ship type has {shipType.GetFields(AccessTools.all).Length} fields");
        }

        private void InitFastBodyFields()
        {
            if (_bodyFastFields != null || _systemBodyAllFields == null) return;

            // Map of obfuscated field name -> what it represents (for reference):
            // v=SystemBodyID, w=SystemID, x=StarID, y=PlanetNumber, z=OrbitNumber,
            // aa=ParentBodyID, ab=ParentBodyType, o=BodyClass, bs=Name,
            // ap=OrbitalDistance, as=Bearing, at=Density, au=Gravity, av=Mass,
            // a7=Radius, an=Xcor, ao=Ycor, bb=Eccentricity, bc=EccentricityDirection,
            // bn=DistanceToOrbitCentre, bo=DistanceToParent, a9=CurrentOrbitalSpeed,
            // ba=MeanOrbitalSpeed, bp=TidalLock, aq=BaseTemp, ar=SurfaceTemp,
            // a2=AtmosPress, a3=Albedo, a4=GHFactor, a0=Roche, a1=MagneticField,
            // a8=Ring, a5=DominantTerrain, cd=AGHFactor, ce=FixedBody,
            // cf=FixedBodyParentID, q=HydroType, r=TectonicActivity
            var needed = new[] {
                "v", "w", "x", "y", "z", "aa", "ab", "o", "bs",
                "ap", "as", "at", "au", "av", "a7", "an", "ao",
                "bb", "bc", "bn", "bo", "a9", "ba", "bp",
                "aq", "ar", "a2", "a3", "a4",
                "a0", "a1", "a8", "a5", "cd", "ce", "cf", "q", "r"
            };

            var fields = new List<FieldInfo>();
            var names = new List<string>();
            foreach (var name in needed)
            {
                var f = _systemBodyAllFields.FirstOrDefault(fi => fi.Name == name);
                if (f != null)
                {
                    fields.Add(f);
                    names.Add(name);
                }
            }
            _bodyFastFields = fields.ToArray();
            _bodyFastFieldNames = names.ToArray();
        }

        #endregion

        #region Helper Methods

        private object GetGameState()
        {
            var map = _lib.TacticalMap;
            if (map == null) return null;
            return _gameStateField.GetValue(map);
        }

        private IEnumerable GetDictValues(FieldInfo dictField, object parent)
        {
            var dict = dictField.GetValue(parent);
            if (dict == null) return null;
            return dict.GetType().GetProperty("Values").GetValue(dict) as IEnumerable;
        }

        private static void ReadPrimitiveFields(FieldInfo[] fields, object source, Dictionary<string, object> target)
        {
            foreach (var f in fields)
            {
                try
                {
                    if (f.FieldType == typeof(int) || f.FieldType == typeof(double)
                        || f.FieldType == typeof(decimal) || f.FieldType == typeof(bool)
                        || f.FieldType == typeof(string) || f.FieldType == typeof(float))
                    {
                        target[f.Name] = f.GetValue(source);
                    }
                    else if (f.FieldType.IsEnum)
                    {
                        target[f.Name] = f.GetValue(source)?.ToString();
                    }
                }
                catch { }
            }
        }

        #endregion

        #region Public API

        /// <summary>
        /// Read system bodies (planets, moons, comets, asteroids).
        /// Reads from GameState.bw (Dict of SystemBody/kc).
        /// Optimized: only reads fields needed for rendering.
        /// </summary>
        public List<Dictionary<string, object>> ReadBodies(int? filterSystemId = null)
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || _systemBodiesDict == null) return results;

            InitFastBodyFields();
            var sw = Stopwatch.StartNew();

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;

                var values = GetDictValues(_systemBodiesDict, gs);
                if (values == null) return results;

                int scanned = 0;

                foreach (var body in values)
                {
                    scanned++;

                    if (filterSystemId.HasValue && _systemBodySystemIdField != null)
                    {
                        try
                        {
                            if ((int)_systemBodySystemIdField.GetValue(body) != filterSystemId.Value)
                                continue;
                        }
                        catch { continue; }
                    }

                    var row = new Dictionary<string, object>(_bodyFastFields.Length);
                    for (int i = 0; i < _bodyFastFields.Length; i++)
                    {
                        var f = _bodyFastFields[i];
                        try
                        {
                            if (f.FieldType.IsEnum)
                                row[_bodyFastFieldNames[i]] = f.GetValue(body)?.ToString();
                            else
                                row[_bodyFastFieldNames[i]] = f.GetValue(body);
                        }
                        catch { }
                    }
                    results.Add(row);
                }

                sw.Stop();
                _patch.LogInfo($"ReadBodies: scanned={scanned}, matched={results.Count}, fields={_bodyFastFields.Length}, total={sw.ElapsedMilliseconds}ms");
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadBodies error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read stars. Reads from GameState.bv (Dict of Star/jo).
        /// Includes StarDetails (kd) sub-object with spectral class, color, etc.
        /// </summary>
        public List<Dictionary<string, object>> ReadStars(int? filterSystemId = null)
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || _starsDict == null || _starAllFields == null) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;

                var values = GetDictValues(_starsDict, gs);
                if (values == null) return results;

                foreach (var star in values)
                {
                    if (filterSystemId.HasValue && _starSystemIdField != null)
                    {
                        try
                        {
                            if ((int)_starSystemIdField.GetValue(star) != filterSystemId.Value)
                                continue;
                        }
                        catch { continue; }
                    }

                    var row = new Dictionary<string, object>();
                    ReadPrimitiveFields(_starAllFields, star, row);

                    // Include StarDetails sub-object (spectral class, color, luminosity)
                    try
                    {
                        var details = _starDetailsField?.GetValue(star);
                        if (details != null && _starDetailsAllFields != null)
                        {
                            var detailsData = new Dictionary<string, object>();
                            ReadPrimitiveFields(_starDetailsAllFields, details, detailsData);
                            row["_starInfo"] = detailsData;
                        }
                    }
                    catch { }

                    results.Add(row);
                }
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadStars error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read the player's known systems directly from the TacticalMap's system ComboBox.
        /// Returns exactly what Aurora shows in the dropdown — player-renamed, surveyed systems only.
        /// </summary>
        public List<Dictionary<string, object>> ReadKnownSystems()
        {
            var results = new List<Dictionary<string, object>>();

            try
            {
                var map = _lib.TacticalMap;
                if (map == null) return results;

                object comboResult = null;
                _patch.InvokeOnUIThread(new Action(() =>
                {
                    try
                    {
                        var comboName = _lib.KnowledgeBase.GetComboBoxName(Lib.AuroraComboBox.Systems);
                        var combo = Lib.UIManager.GetControlByName<System.Windows.Forms.ComboBox>(map, comboName);
                        if (combo == null || combo.Items.Count == 0) return;

                        var items = new List<Dictionary<string, object>>();
                        foreach (var item in combo.Items)
                        {
                            try
                            {
                                // Get displayed name via DisplayMember or ToString
                                string name = null;
                                if (!string.IsNullOrEmpty(combo.DisplayMember))
                                {
                                    var prop = item.GetType().GetProperty(combo.DisplayMember);
                                    if (prop != null)
                                        name = prop.GetValue(item)?.ToString();
                                    else
                                    {
                                        var dmField = item.GetType().GetField(combo.DisplayMember, AccessTools.all);
                                        if (dmField != null)
                                            name = dmField.GetValue(item)?.ToString();
                                    }
                                }
                                if (string.IsNullOrEmpty(name))
                                    name = item.ToString();

                                // Get SystemID — items are jx type, check for field 'ac' (system name)
                                // or look for an int field that matches a known SystemID pattern
                                int systemId = 0;
                                foreach (var f in item.GetType().GetFields(AccessTools.all))
                                {
                                    if (f.FieldType == typeof(int))
                                    {
                                        var val = (int)f.GetValue(item);
                                        // SystemIDs are large ints (>20000 in this game)
                                        if (val > 10000 && systemId == 0)
                                        {
                                            systemId = val;
                                        }
                                    }
                                }

                                // If jx type, try to find the StarSystem ref and get g=SystemID
                                if (systemId == 0)
                                {
                                    foreach (var f in item.GetType().GetFields(AccessTools.all))
                                    {
                                        if (!f.FieldType.IsEnum && !f.FieldType.IsPrimitive && f.FieldType.Name != "String")
                                        {
                                            var refObj = f.GetValue(item);
                                            if (refObj != null)
                                            {
                                                var gField = refObj.GetType().GetField("g", AccessTools.all);
                                                if (gField != null && gField.FieldType == typeof(int))
                                                {
                                                    systemId = (int)gField.GetValue(refObj);
                                                    if (systemId > 10000) break;
                                                    systemId = 0;
                                                }
                                            }
                                        }
                                    }
                                }

                                items.Add(new Dictionary<string, object>
                                {
                                    ["SystemID"] = systemId,
                                    ["Name"] = name ?? $"System {systemId}"
                                });
                            }
                            catch { }
                        }
                        comboResult = items;
                    }
                    catch { }
                }));

                if (comboResult is List<Dictionary<string, object>> list)
                {
                    results = list;
                    _patch.LogInfo($"ReadKnownSystems: {results.Count} systems from TacticalMap ComboBox");
                }
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadKnownSystems error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read star systems with resolved names.
        /// Systems from GameState.bu (Dict of StarSystem/js).
        /// Names from GameState.b2 (Dict of SystemNameRecord/jq).
        /// </summary>
        public List<Dictionary<string, object>> ReadSystems()
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || _starSystemsDict == null || _starSystemIdFieldOnJs == null) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;

                // Build SystemID -> Name lookup from SystemNameRecords
                var nameMap = BuildSystemNameMap(gs);

                var values = GetDictValues(_starSystemsDict, gs);
                if (values == null) return results;

                foreach (var system in values)
                {
                    try
                    {
                        var systemId = (int)_starSystemIdFieldOnJs.GetValue(system);
                        string name;
                        nameMap.TryGetValue(systemId, out name);

                        results.Add(new Dictionary<string, object>
                        {
                            ["SystemID"] = systemId,
                            ["Name"] = name ?? $"System {systemId}"
                        });
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadSystems error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read fleets with positions. Reads from GameState.bm (Dict of Fleet/f4).
        /// Returns FleetID, FleetName, Speed, Xcor, Ycor, RaceID, and ship count.
        /// </summary>
        public List<Dictionary<string, object>> ReadFleets()
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || _fleetsDict == null) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;

                var values = GetDictValues(_fleetsDict, gs);
                if (values == null) return results;

                // Build fleet -> ship count map
                var shipCounts = new Dictionary<int, int>();
                if (_shipsDict != null)
                {
                    var shipValues = GetDictValues(_shipsDict, gs);
                    if (shipValues != null)
                    {
                        // Ship type has a fleet ref — find the field that references f4 (fleet type)
                        var shipType = _shipsDict.FieldType.GenericTypeArguments[1];
                        FieldInfo shipFleetRefField = null;

                        foreach (var f in shipType.GetFields(AccessTools.all))
                        {
                            if (f.FieldType == _fleetsDict.FieldType.GenericTypeArguments[1])
                            {
                                shipFleetRefField = f;
                                break;
                            }
                        }

                        if (shipFleetRefField != null && _fleetIdField != null)
                        {
                            foreach (var ship in shipValues)
                            {
                                try
                                {
                                    var fleetRef = shipFleetRefField.GetValue(ship);
                                    if (fleetRef != null)
                                    {
                                        var fleetId = (int)_fleetIdField.GetValue(fleetRef);
                                        if (!shipCounts.ContainsKey(fleetId))
                                            shipCounts[fleetId] = 0;
                                        shipCounts[fleetId]++;
                                    }
                                }
                                catch { }
                            }
                        }
                    }
                }

                foreach (var fleet in values)
                {
                    try
                    {
                        var row = new Dictionary<string, object>();

                        if (_fleetIdField != null)
                            row["FleetID"] = _fleetIdField.GetValue(fleet);
                        if (_fleetNameField != null)
                            row["FleetName"] = _fleetNameField.GetValue(fleet);
                        if (_fleetSpeedField != null)
                            row["Speed"] = _fleetSpeedField.GetValue(fleet);
                        if (_fleetXcorField != null)
                            row["Xcor"] = _fleetXcorField.GetValue(fleet);
                        if (_fleetYcorField != null)
                            row["Ycor"] = _fleetYcorField.GetValue(fleet);

                        // Read SystemID from ref field k (kc/SystemBody) -> sub-field w
                        int systemId = 0;
                        try
                        {
                            var orbitBodyRef = _fleetsDict.FieldType.GenericTypeArguments[1].GetField("k", AccessTools.all);
                            if (orbitBodyRef != null)
                            {
                                var bodyObj = orbitBodyRef.GetValue(fleet);
                                if (bodyObj != null && _systemBodySystemIdField != null)
                                    systemId = (int)_systemBodySystemIdField.GetValue(bodyObj);
                            }
                        }
                        catch { }
                        row["SystemID"] = systemId;

                        // Read SystemName from ref field i (jx/navigation) -> sub-field ac
                        string systemName = null;
                        if (_fleetNavField != null)
                        {
                            try
                            {
                                var navRef = _fleetNavField.GetValue(fleet);
                                if (navRef != null)
                                {
                                    var acField = navRef.GetType().GetField("ac", AccessTools.all);
                                    if (acField != null)
                                        systemName = acField.GetValue(navRef) as string;
                                }
                            }
                            catch { }
                        }
                        row["SystemName"] = systemName ?? "";

                        // Read IsCivilian from field ay
                        if (_fleetCivilianField != null)
                        {
                            try { row["IsCivilian"] = (bool)_fleetCivilianField.GetValue(fleet); }
                            catch { row["IsCivilian"] = false; }
                        }

                        // Read RaceID from ref field h -> sub-field ck
                        int raceId = 0;
                        if (_fleetRaceRefField != null)
                        {
                            try
                            {
                                var raceRef = _fleetRaceRefField.GetValue(fleet);
                                if (raceRef != null)
                                {
                                    var ckField = raceRef.GetType().GetField("ck", AccessTools.all);
                                    if (ckField != null)
                                        raceId = (int)ckField.GetValue(raceRef);
                                }
                            }
                            catch { }
                        }
                        row["RaceID"] = raceId;

                        // Ship count
                        var fleetId = row.ContainsKey("FleetID") ? (int)row["FleetID"] : 0;
                        int sc;
                        row["ShipCount"] = shipCounts.TryGetValue(fleetId, out sc) ? sc : 0;

                        results.Add(row);
                    }
                    catch { }
                }

                _patch.LogInfo($"ReadFleets: {results.Count} fleets");
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadFleets error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read ships. Reads from GameState.bp (Dict of Ship/a2).
        /// Returns ShipID, ShipName, Fuel, and FleetID.
        /// </summary>
        public List<Dictionary<string, object>> ReadShips(int? filterFleetId = null)
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || _shipsDict == null) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;

                var values = GetDictValues(_shipsDict, gs);
                if (values == null) return results;

                var shipType = _shipsDict.FieldType.GenericTypeArguments[1];

                // Find the field that holds a reference to a fleet (f4 type)
                FieldInfo shipFleetRefField = null;
                if (_fleetsDict != null)
                {
                    var fleetValueType = _fleetsDict.FieldType.GenericTypeArguments[1];
                    foreach (var f in shipType.GetFields(AccessTools.all))
                    {
                        if (f.FieldType == fleetValueType)
                        {
                            shipFleetRefField = f;
                            break;
                        }
                    }
                }

                foreach (var ship in values)
                {
                    try
                    {
                        // Get FleetID from the fleet ref
                        int fleetId = 0;
                        if (shipFleetRefField != null && _fleetIdField != null)
                        {
                            var fleetRef = shipFleetRefField.GetValue(ship);
                            if (fleetRef != null)
                                fleetId = (int)_fleetIdField.GetValue(fleetRef);
                        }

                        if (filterFleetId.HasValue && fleetId != filterFleetId.Value)
                            continue;

                        var row = new Dictionary<string, object>();
                        if (_shipIdField != null)
                            row["ShipID"] = _shipIdField.GetValue(ship);
                        if (_shipNameField != null)
                            row["ShipName"] = _shipNameField.GetValue(ship);
                        if (_shipFuelField != null)
                            row["Fuel"] = _shipFuelField.GetValue(ship);
                        row["FleetID"] = fleetId;

                        results.Add(row);
                    }
                    catch { }
                }

                _patch.LogInfo($"ReadShips: {results.Count} ships (filter={filterFleetId})");
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadShips error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Search all GameState collections for items containing specific Int32 values.
        /// Useful for discovering which collection holds a particular game object.
        /// </summary>
        public List<Dictionary<string, object>> GlobalSearch(int[] searchValues)
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize()) return results;

            try
            {
                var map = _lib.TacticalMap;
                if (map == null) return results;

                var gs = _gameStateField.GetValue(map);
                if (gs == null) return results;

                var gsType = gs.GetType();
                var auroraAsm = map.GetType().Assembly;

                foreach (var collectionField in gsType.GetFields(AccessTools.all))
                {
                    if (!collectionField.FieldType.IsGenericType) continue;
                    var genDef = collectionField.FieldType.GetGenericTypeDefinition();
                    if (genDef != typeof(Dictionary<,>) && genDef != typeof(List<>)) continue;

                    try
                    {
                        var collection = collectionField.GetValue(gs);
                        if (collection == null) continue;

                        var countProp = collection.GetType().GetProperty("Count");
                        int count = countProp != null ? (int)countProp.GetValue(collection) : 0;
                        if (count == 0) continue;

                        IEnumerable values = genDef == typeof(Dictionary<,>)
                            ? collection.GetType().GetProperty("Values").GetValue(collection) as IEnumerable
                            : collection as IEnumerable;

                        if (values == null) continue;

                        foreach (var item in values)
                        {
                            if (item == null) continue;
                            var itemType = item.GetType();

                            // Search direct Int32 fields
                            if (SearchDirectFields(item, itemType, searchValues, collectionField.Name, count, results))
                                goto nextItem;

                            // Search 1 level deep into Aurora-type references
                            SearchReferenceFields(item, itemType, auroraAsm, searchValues, collectionField.Name, count, results);

                            nextItem:;
                        }
                    }
                    catch { }
                }
            }
            catch (Exception ex)
            {
                _patch.LogError($"GlobalSearch error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Enumerate ALL collections on GameState — every Dict and List field.
        /// Returns field name, item type, item count, and field schema for each.
        /// This is the discovery entry point: call this first to see what's available.
        /// </summary>
        public List<Dictionary<string, object>> EnumerateCollections()
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize()) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;
                var gsType = gs.GetType();

                foreach (var field in gsType.GetFields(AccessTools.all))
                {
                    if (!field.FieldType.IsGenericType) continue;
                    var genDef = field.FieldType.GetGenericTypeDefinition();

                    bool isDict = genDef == typeof(Dictionary<,>);
                    bool isList = genDef == typeof(List<>);
                    if (!isDict && !isList) continue;

                    try
                    {
                        var collection = field.GetValue(gs);
                        int count = 0;
                        if (collection != null)
                        {
                            var countProp = collection.GetType().GetProperty("Count");
                            if (countProp != null) count = (int)countProp.GetValue(collection);
                        }

                        // Get the item type (value type for Dict, element type for List)
                        var itemType = isDict
                            ? field.FieldType.GenericTypeArguments[1]
                            : field.FieldType.GenericTypeArguments[0];

                        // Build field schema for the item type
                        var schema = new List<Dictionary<string, string>>();
                        foreach (var f in itemType.GetFields(AccessTools.all))
                        {
                            string typeName;
                            if (f.FieldType.IsEnum) typeName = "enum";
                            else if (f.FieldType == typeof(int)) typeName = "int";
                            else if (f.FieldType == typeof(double)) typeName = "double";
                            else if (f.FieldType == typeof(float)) typeName = "float";
                            else if (f.FieldType == typeof(decimal)) typeName = "decimal";
                            else if (f.FieldType == typeof(bool)) typeName = "bool";
                            else if (f.FieldType == typeof(string)) typeName = "string";
                            else if (f.FieldType == typeof(long)) typeName = "long";
                            else typeName = $"ref:{f.FieldType.Name}";

                            schema.Add(new Dictionary<string, string>
                            {
                                ["name"] = f.Name,
                                ["type"] = typeName
                            });
                        }

                        var keyType = isDict ? field.FieldType.GenericTypeArguments[0].Name : null;

                        results.Add(new Dictionary<string, object>
                        {
                            ["field"] = field.Name,
                            ["collectionType"] = isDict ? "Dict" : "List",
                            ["keyType"] = keyType,
                            ["itemType"] = itemType.Name,
                            ["count"] = count,
                            ["fieldCount"] = itemType.GetFields(AccessTools.all).Length,
                            ["schema"] = schema
                        });
                    }
                    catch { }
                }

                _patch.LogInfo($"EnumerateCollections: found {results.Count} collections on GameState");
            }
            catch (Exception ex)
            {
                _patch.LogError($"EnumerateCollections error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read items from ANY GameState collection by field name.
        /// Returns all primitive/enum fields on each item.
        /// Optionally reads 1 level of sub-object fields (Aurora type references).
        /// Supports limit/offset for large collections, and field filtering.
        /// </summary>
        public List<Dictionary<string, object>> ReadCollection(string fieldName, int offset = 0, int limit = 100,
            string[] fields = null, bool includeRefs = false, string filterField = null, string filterValue = null)
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize() || string.IsNullOrEmpty(fieldName)) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;
                var gsType = gs.GetType();

                var collectionFieldInfo = gsType.GetField(fieldName, AccessTools.all);
                if (collectionFieldInfo == null)
                {
                    _patch.LogError($"ReadCollection: field '{fieldName}' not found on GameState");
                    return results;
                }

                var collection = collectionFieldInfo.GetValue(gs);
                if (collection == null) return results;

                // Get the enumerable values
                IEnumerable values;
                var ft = collectionFieldInfo.FieldType;
                if (ft.IsGenericType && ft.GetGenericTypeDefinition() == typeof(Dictionary<,>))
                    values = ft.GetProperty("Values").GetValue(collection) as IEnumerable;
                else
                    values = collection as IEnumerable;

                if (values == null) return results;

                var auroraAsm = _lib.TacticalMap?.GetType().Assembly;

                // Build field filter set
                HashSet<string> fieldFilter = null;
                if (fields != null && fields.Length > 0)
                    fieldFilter = new HashSet<string>(fields);

                int index = 0;
                FieldInfo[] cachedItemFields = null;

                // Parse filter value for comparison
                int filterIntVal = 0;
                double filterDoubleVal = 0;
                bool filterIsInt = false, filterIsDouble = false;
                FieldInfo filterFieldInfo = null;

                foreach (var item in values)
                {
                    if (item == null) { index++; continue; }

                    // Cache fields on first item
                    if (cachedItemFields == null)
                    {
                        cachedItemFields = item.GetType().GetFields(AccessTools.all);

                        // Resolve filter field
                        if (!string.IsNullOrEmpty(filterField) && !string.IsNullOrEmpty(filterValue))
                        {
                            filterFieldInfo = cachedItemFields.FirstOrDefault(f => f.Name == filterField);
                            if (filterFieldInfo != null)
                            {
                                filterIsInt = int.TryParse(filterValue, out filterIntVal);
                                filterIsDouble = double.TryParse(filterValue, out filterDoubleVal);
                            }
                        }
                    }

                    // Apply filter
                    if (filterFieldInfo != null)
                    {
                        try
                        {
                            var fv = filterFieldInfo.GetValue(item);
                            bool match = false;
                            if (filterIsInt && fv is int iv) match = iv == filterIntVal;
                            else if (filterIsDouble && fv is double dv) match = Math.Abs(dv - filterDoubleVal) < 0.001;
                            else if (fv is bool bv) match = bv.ToString().Equals(filterValue, StringComparison.OrdinalIgnoreCase);
                            else if (fv is string sv) match = sv.Equals(filterValue, StringComparison.OrdinalIgnoreCase);
                            else if (fv != null && fv.GetType().IsEnum) match = fv.ToString().Equals(filterValue, StringComparison.OrdinalIgnoreCase);

                            if (!match) { index++; continue; }
                        }
                        catch { index++; continue; }
                    }

                    // Apply offset
                    if (index < offset) { index++; continue; }

                    // Apply limit
                    if (results.Count >= limit) break;

                    var row = new Dictionary<string, object>();
                    row["_index"] = index;

                    foreach (var f in cachedItemFields)
                    {
                        if (fieldFilter != null && !fieldFilter.Contains(f.Name)) continue;

                        try
                        {
                            if (f.FieldType == typeof(int) || f.FieldType == typeof(double)
                                || f.FieldType == typeof(decimal) || f.FieldType == typeof(bool)
                                || f.FieldType == typeof(string) || f.FieldType == typeof(float)
                                || f.FieldType == typeof(long))
                            {
                                row[f.Name] = f.GetValue(item);
                            }
                            else if (f.FieldType.IsEnum)
                            {
                                row[f.Name] = f.GetValue(item)?.ToString();
                            }
                            else if (includeRefs && auroraAsm != null && f.FieldType.Assembly == auroraAsm && !f.FieldType.IsEnum)
                            {
                                // Read 1 level deep into Aurora type references
                                var refObj = f.GetValue(item);
                                if (refObj != null)
                                {
                                    var subData = new Dictionary<string, object>();
                                    subData["_type"] = f.FieldType.Name;
                                    ReadPrimitiveFields(f.FieldType.GetFields(AccessTools.all), refObj, subData);
                                    if (subData.Count > 1) // more than just _type
                                        row[f.Name] = subData;
                                }
                            }
                        }
                        catch { }
                    }

                    results.Add(row);
                    index++;
                }

                _patch.LogInfo($"ReadCollection({fieldName}): offset={offset}, limit={limit}, returned={results.Count}");
            }
            catch (Exception ex)
            {
                _patch.LogError($"ReadCollection error: {ex.Message}");
            }

            return results;
        }

        /// <summary>
        /// Read a single scalar (non-collection) field from GameState.
        /// Returns the value and its type. Useful for game clock, turn number, etc.
        /// </summary>
        public Dictionary<string, object> ReadGameStateField(string fieldName)
        {
            var result = new Dictionary<string, object>();
            if (!Initialize() || string.IsNullOrEmpty(fieldName)) return result;

            try
            {
                var gs = GetGameState();
                if (gs == null) return result;

                var field = gs.GetType().GetField(fieldName, AccessTools.all);
                if (field == null)
                {
                    result["error"] = $"Field '{fieldName}' not found on GameState";
                    return result;
                }

                result["field"] = fieldName;
                result["type"] = field.FieldType.IsEnum ? "enum" : field.FieldType.Name;

                var val = field.GetValue(gs);
                if (val == null)
                {
                    result["value"] = null;
                }
                else if (field.FieldType == typeof(int) || field.FieldType == typeof(double)
                    || field.FieldType == typeof(decimal) || field.FieldType == typeof(bool)
                    || field.FieldType == typeof(string) || field.FieldType == typeof(float)
                    || field.FieldType == typeof(long))
                {
                    result["value"] = val;
                }
                else if (field.FieldType.IsEnum)
                {
                    result["value"] = val.ToString();
                }
                else if (field.FieldType.IsGenericType)
                {
                    var countProp = field.FieldType.GetProperty("Count");
                    result["value"] = $"[collection, count={countProp?.GetValue(val) ?? "?"}]";
                }
                else
                {
                    // Aurora reference type — dump its primitive fields
                    var subData = new Dictionary<string, object>();
                    subData["_type"] = field.FieldType.Name;
                    ReadPrimitiveFields(field.FieldType.GetFields(AccessTools.all), val, subData);
                    result["value"] = subData;
                }
            }
            catch (Exception ex)
            {
                result["error"] = ex.Message;
            }

            return result;
        }

        /// <summary>
        /// List ALL fields on GameState (326+), with their types and summary values.
        /// This is the top-level schema of the entire game state.
        /// </summary>
        public List<Dictionary<string, object>> EnumerateGameStateFields()
        {
            var results = new List<Dictionary<string, object>>();
            if (!Initialize()) return results;

            try
            {
                var gs = GetGameState();
                if (gs == null) return results;
                var gsType = gs.GetType();

                foreach (var field in gsType.GetFields(AccessTools.all))
                {
                    var entry = new Dictionary<string, object>
                    {
                        ["name"] = field.Name
                    };

                    if (field.FieldType.IsEnum)
                    {
                        entry["type"] = "enum";
                        try { entry["value"] = field.GetValue(gs)?.ToString(); } catch { }
                    }
                    else if (field.FieldType == typeof(int) || field.FieldType == typeof(double)
                        || field.FieldType == typeof(decimal) || field.FieldType == typeof(bool)
                        || field.FieldType == typeof(string) || field.FieldType == typeof(float)
                        || field.FieldType == typeof(long))
                    {
                        entry["type"] = field.FieldType.Name;
                        try { entry["value"] = field.GetValue(gs); } catch { }
                    }
                    else if (field.FieldType.IsGenericType)
                    {
                        var genDef = field.FieldType.GetGenericTypeDefinition();
                        if (genDef == typeof(Dictionary<,>))
                        {
                            var valType = field.FieldType.GenericTypeArguments[1];
                            entry["type"] = $"Dict<{field.FieldType.GenericTypeArguments[0].Name},{valType.Name}>";
                            entry["itemFields"] = valType.GetFields(AccessTools.all).Length;
                        }
                        else if (genDef == typeof(List<>))
                        {
                            var valType = field.FieldType.GenericTypeArguments[0];
                            entry["type"] = $"List<{valType.Name}>";
                            entry["itemFields"] = valType.GetFields(AccessTools.all).Length;
                        }
                        else
                        {
                            entry["type"] = field.FieldType.Name;
                        }

                        try
                        {
                            var col = field.GetValue(gs);
                            if (col != null)
                            {
                                var cp = col.GetType().GetProperty("Count");
                                if (cp != null) entry["count"] = (int)cp.GetValue(col);
                            }
                        }
                        catch { }
                    }
                    else
                    {
                        entry["type"] = $"ref:{field.FieldType.Name}";
                        entry["refFields"] = field.FieldType.GetFields(AccessTools.all).Length;
                    }

                    results.Add(entry);
                }

                _patch.LogInfo($"EnumerateGameStateFields: {results.Count} fields");
            }
            catch (Exception ex)
            {
                _patch.LogError($"EnumerateGameStateFields error: {ex.Message}");
            }

            return results;
        }

        #endregion

        #region Private Search Helpers

        private Dictionary<int, string> BuildSystemNameMap(object gameState)
        {
            var nameMap = new Dictionary<int, string>();
            if (_systemNameRecordsDict == null || _systemNameSystemIdField == null || _systemNameField == null)
                return nameMap;

            var values = GetDictValues(_systemNameRecordsDict, gameState);
            if (values == null) return nameMap;

            foreach (var record in values)
            {
                try
                {
                    var sysId = (int)_systemNameSystemIdField.GetValue(record);
                    var name = _systemNameField.GetValue(record) as string;
                    if (!string.IsNullOrEmpty(name) && !nameMap.ContainsKey(sysId))
                        nameMap[sysId] = name;
                }
                catch { }
            }

            return nameMap;
        }

        private static bool SearchDirectFields(object item, Type itemType, int[] searchValues,
            string collectionName, int collectionCount, List<Dictionary<string, object>> results)
        {
            foreach (var f in itemType.GetFields(AccessTools.all))
            {
                if (f.FieldType != typeof(int)) continue;
                try
                {
                    int val = (int)f.GetValue(item);
                    foreach (var sv in searchValues)
                    {
                        if (val == sv)
                        {
                            var hit = CreateSearchHit(item, itemType, f.Name, val, collectionName, collectionCount);
                            results.Add(hit);
                            return true;
                        }
                    }
                }
                catch { }
            }
            return false;
        }

        private static void SearchReferenceFields(object item, Type itemType, Assembly auroraAsm,
            int[] searchValues, string collectionName, int collectionCount, List<Dictionary<string, object>> results)
        {
            foreach (var f in itemType.GetFields(AccessTools.all))
            {
                if (f.FieldType.Assembly != auroraAsm || f.FieldType.IsEnum) continue;
                try
                {
                    var refObj = f.GetValue(item);
                    if (refObj == null) continue;
                    foreach (var rf in f.FieldType.GetFields(AccessTools.all))
                    {
                        if (rf.FieldType != typeof(int)) continue;
                        int val = (int)rf.GetValue(refObj);
                        foreach (var sv in searchValues)
                        {
                            if (val == sv)
                            {
                                var hit = CreateSearchHit(item, itemType, $"{f.Name}.{rf.Name}", val, collectionName, collectionCount);
                                results.Add(hit);
                                return;
                            }
                        }
                    }
                }
                catch { }
            }
        }

        private static Dictionary<string, object> CreateSearchHit(object item, Type itemType,
            string matchField, int matchValue, string collectionName, int collectionCount)
        {
            var hit = new Dictionary<string, object>
            {
                ["_collection"] = collectionName,
                ["_itemType"] = itemType.Name,
                ["_itemFields"] = itemType.GetFields(AccessTools.all).Length,
                ["_matchField"] = matchField,
                ["_matchValue"] = matchValue,
                ["_collectionCount"] = collectionCount
            };

            int shown = 0;
            foreach (var pf in itemType.GetFields(AccessTools.all))
            {
                if (shown >= 20) break;
                try
                {
                    if (pf.FieldType == typeof(int) || pf.FieldType == typeof(double)
                        || pf.FieldType == typeof(decimal) || pf.FieldType == typeof(bool)
                        || pf.FieldType == typeof(string))
                    {
                        hit[$"val_{pf.Name}"] = pf.GetValue(item);
                        shown++;
                    }
                }
                catch { }
            }

            return hit;
        }

        #endregion
    }
}
