using System;
using System.Collections.Generic;

namespace AdvisorBridge.Providers
{
    /// <summary>
    /// Generic game state exploration tools for dev/discovery use.
    /// These are memory-only — they inspect live GameState objects via reflection.
    ///
    /// Used to discover obfuscated field names and map them to SQL tables.
    /// </summary>
    public class GameStateExplorer
    {
        private readonly MemoryReader _memory;
        private readonly AuroraPatch.Patch _patch;

        public GameStateExplorer(MemoryReader memory, AuroraPatch.Patch patch)
        {
            _memory = memory;
            _patch = patch;
        }

        /// <summary>
        /// List all top-level fields on the GameState object with their types and values.
        /// </summary>
        public List<Dictionary<string, object>> EnumerateGameState()
        {
            return _memory.EnumerateGameStateFields();
        }

        /// <summary>
        /// List all collection-type fields (Dictionary, List, Array) on GameState
        /// with element types and counts.
        /// </summary>
        public List<Dictionary<string, object>> EnumerateCollections()
        {
            return _memory.EnumerateCollections();
        }

        /// <summary>
        /// Read items from a named collection field on GameState.
        /// Supports paging, field selection, reference expansion, and filtering.
        /// </summary>
        public List<Dictionary<string, object>> ReadCollection(
            string fieldName,
            int offset = 0,
            int limit = 100,
            string[] fields = null,
            bool includeRefs = false,
            string filterField = null,
            string filterValue = null)
        {
            return _memory.ReadCollection(fieldName, offset, limit, fields, includeRefs, filterField, filterValue);
        }

        /// <summary>
        /// Read a single top-level field from GameState.
        /// </summary>
        public Dictionary<string, object> ReadField(string fieldName)
        {
            return _memory.ReadGameStateField(fieldName);
        }

        /// <summary>
        /// Search all GameState collections for objects containing specific int values.
        /// Used to discover which obfuscated fields correspond to known IDs (e.g. SystemID, RaceID).
        /// </summary>
        public List<Dictionary<string, object>> GlobalSearch(int[] searchValues)
        {
            return _memory.GlobalSearch(searchValues);
        }
    }
}
