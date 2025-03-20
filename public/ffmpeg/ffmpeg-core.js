// This is a placeholder that will cause FFmpeg to fall back to CDN loading
console.log('FFmpeg core placeholder loaded, will try CDN fallback');
throw new Error('Local FFmpeg core not available');

// This is just to provide a minimal interface so the app doesn't crash
var Module = {
  print: function(text) {
    console.log('[FFmpeg]', text);
  },
  printErr: function(text) {
    console.error('[FFmpeg]', text);
  },
  onRuntimeInitialized: function() {
    console.log('[FFmpeg] Core initialized');
  }
};

// Export the Module
if (typeof exports === 'object' && typeof module === 'object')
  module.exports = Module;
else if (typeof define === 'function' && define['amd'])
  define([], function() { return Module; });
else if (typeof exports === 'object')
  exports["Module"] = Module;
