{
  "targets": [
    {
      "target_name": "window_capture_exclude",
      "conditions": [
        ["OS!='mac'", { "type": "none" }],
        ["OS=='mac'", {
          "sources": ["window_capture_exclude.mm"],
          "link_settings": {
            "libraries": [
              "-framework Cocoa",
              "-framework CoreGraphics"
            ]
          }
        }]
      ]
    },
    {
      "target_name": "dictation_ptt",
      "conditions": [
        ["OS=='mac'", {
          "sources": ["dictation_ptt.mm"],
          "link_settings": {
            "libraries": [
              "-framework ApplicationServices",
              "-framework CoreFoundation"
            ]
          }
        }],
        ["OS=='win'", {
          "sources": ["dictation_ptt_win.cc"],
          "defines": ["NOMINMAX", "WIN32_LEAN_AND_MEAN"],
          "msvs_settings": {
            "VCCLCompilerTool": {
              "LanguageStandard": "stdcpp17"
            }
          },
          "link_settings": {
            "libraries": ["user32.lib"]
          }
        }]
      ]
    }
  ]
}
