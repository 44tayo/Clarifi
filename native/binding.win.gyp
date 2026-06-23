{
  "targets": [
    {
      "target_name": "dictation_ptt",
      "sources": ["dictation_ptt_win.cc"],
      "defines": ["NOMINMAX", "WIN32_LEAN_AND_MEAN"],
      "link_settings": {
        "libraries": ["user32.lib"]
      }
    }
  ]
}
