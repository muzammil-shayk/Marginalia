/** Made by scripts/capture-guide.cjs; do not edit. Re-run `npm run guide:capture`. */

import type { GuideStep } from './guideSteps';

export const GUIDE_STEPS: Record<string, GuideStep[]> = {
  "archive": [
    {
      "action": "hover",
      "at": {
        "x": 81,
        "y": 9.6
      },
      "frame": "steps/archive/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 81,
        "y": 9.6
      },
      "frame": "steps/archive/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 70.8,
        "y": 73
      },
      "frame": "steps/archive/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 50,
        "y": 52.1
      },
      "frame": "steps/archive/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 62.4,
        "y": 58.8
      },
      "frame": "steps/archive/4.jpg"
    }
  ],
  "blackout": [
    {
      "action": "hover",
      "at": {
        "x": 38.2,
        "y": 8.9
      },
      "frame": "steps/blackout/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 38.2,
        "y": 8.9
      },
      "frame": "steps/blackout/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 16.2,
        "y": 15.5
      },
      "frame": "steps/blackout/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 52.2
      },
      "to": {
        "x": 56,
        "y": 52.2
      },
      "frame": "steps/blackout/3.jpg"
    }
  ],
  "board": [
    {
      "action": "hover",
      "at": {
        "x": 37.5,
        "y": 16.7
      },
      "frame": "steps/board/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 37.5,
        "y": 16.7
      },
      "frame": "steps/board/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 35,
        "y": 40.9
      },
      "frame": "steps/board/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 63.5,
        "y": 76.2
      },
      "frame": "steps/board/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 76.9,
        "y": 36.3
      },
      "frame": "steps/board/4.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 80.4,
        "y": 39.5
      },
      "frame": "steps/board/5.jpg"
    }
  ],
  "classpack": [
    {
      "action": "hover",
      "at": {
        "x": 80.9,
        "y": 9.6
      },
      "frame": "steps/classpack/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 80.9,
        "y": 9.6
      },
      "frame": "steps/classpack/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 58.3,
        "y": 74.6
      },
      "frame": "steps/classpack/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 8.6,
        "y": 23.3
      },
      "frame": "steps/classpack/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 77.1,
        "y": 77.5
      },
      "frame": "steps/classpack/4.jpg"
    }
  ],
  "export": [
    {
      "action": "hover",
      "at": {
        "x": 34.6,
        "y": 16.7
      },
      "frame": "steps/export/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 34.6,
        "y": 16.7
      },
      "frame": "steps/export/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 30.3,
        "y": 43.7
      },
      "frame": "steps/export/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 58.6,
        "y": 53.4
      },
      "frame": "steps/export/3.jpg"
    },
    {
      "action": "hover",
      "at": {
        "x": 50,
        "y": 43.6
      },
      "frame": "steps/export/4.jpg"
    }
  ],
  "find": [
    {
      "action": "hover",
      "at": {
        "x": 23.8,
        "y": 40.8
      },
      "frame": "steps/find/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 23.8,
        "y": 40.8
      },
      "keys": "Mod+F",
      "frame": "steps/find/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 34.8,
        "y": 21.9
      },
      "keys": "reader",
      "frame": "steps/find/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 61.4,
        "y": 21.9
      },
      "frame": "steps/find/3.jpg"
    }
  ],
  "focus": [
    {
      "action": "hover",
      "at": {
        "x": 97.8,
        "y": 9.6
      },
      "frame": "steps/focus/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 97.8,
        "y": 9.6
      },
      "frame": "steps/focus/1.jpg"
    },
    {
      "action": "hover",
      "at": {
        "x": 0.5,
        "y": 50
      },
      "frame": "steps/focus/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 2.9,
        "y": 27.9
      },
      "frame": "steps/focus/3.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 19.7,
        "y": 22.2
      },
      "to": {
        "x": 36,
        "y": 22.2
      },
      "frame": "steps/focus/4.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 19.7,
        "y": 22.2
      },
      "keys": "Esc",
      "frame": "steps/focus/5.jpg"
    }
  ],
  "key-area": [
    {
      "action": "hover",
      "at": {
        "x": 40.9,
        "y": 40.8
      },
      "frame": "steps/key-area/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 40.9,
        "y": 40.8
      },
      "keys": "A",
      "frame": "steps/key-area/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 40.9,
        "y": 40.8
      },
      "to": {
        "x": 78.3,
        "y": 79.9
      },
      "frame": "steps/key-area/2.jpg"
    }
  ],
  "key-collapse": [
    {
      "action": "hover",
      "at": {
        "x": 58.6,
        "y": 52
      },
      "frame": "steps/key-collapse/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 58.6,
        "y": 52
      },
      "keys": "C",
      "frame": "steps/key-collapse/1.jpg"
    }
  ],
  "key-delete": [
    {
      "action": "hover",
      "at": {
        "x": 56.1,
        "y": 33.7
      },
      "frame": "steps/key-delete/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 56.1,
        "y": 33.7
      },
      "keys": "V",
      "frame": "steps/key-delete/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 56.1,
        "y": 33.7
      },
      "frame": "steps/key-delete/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 56.1,
        "y": 33.7
      },
      "keys": "Delete",
      "frame": "steps/key-delete/3.jpg"
    }
  ],
  "key-escape": [
    {
      "action": "hover",
      "at": {
        "x": 63.5,
        "y": 92.2
      },
      "frame": "steps/key-escape/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 63.5,
        "y": 92.2
      },
      "keys": "P",
      "frame": "steps/key-escape/1.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 63.5,
        "y": 92.2
      },
      "keys": "Esc",
      "frame": "steps/key-escape/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 77,
        "y": 9.3
      },
      "frame": "steps/key-escape/3.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 77,
        "y": 9.3
      },
      "keys": "Esc",
      "frame": "steps/key-escape/4.jpg"
    }
  ],
  "key-find": [
    {
      "action": "hover",
      "at": {
        "x": 23.8,
        "y": 61.2
      },
      "frame": "steps/key-find/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 23.8,
        "y": 61.2
      },
      "keys": "Mod+F",
      "frame": "steps/key-find/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 34.8,
        "y": 21.9
      },
      "keys": "margin",
      "frame": "steps/key-find/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 34.8,
        "y": 21.9
      },
      "keys": "Enter",
      "frame": "steps/key-find/3.jpg"
    }
  ],
  "key-focus": [
    {
      "action": "hover",
      "at": {
        "x": 41.7,
        "y": 51.6
      },
      "frame": "steps/key-focus/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 51.6
      },
      "keys": "F",
      "frame": "steps/key-focus/1.jpg"
    }
  ],
  "key-highlight": [
    {
      "action": "hover",
      "at": {
        "x": 70.8,
        "y": 33.8
      },
      "frame": "steps/key-highlight/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 70.8,
        "y": 33.8
      },
      "keys": "H",
      "frame": "steps/key-highlight/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 70.8,
        "y": 33.8
      },
      "to": {
        "x": 44.2,
        "y": 37
      },
      "frame": "steps/key-highlight/2.jpg"
    }
  ],
  "key-note": [
    {
      "action": "hover",
      "at": {
        "x": 61.1,
        "y": 87.7
      },
      "frame": "steps/key-note/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 61.1,
        "y": 87.7
      },
      "keys": "N",
      "frame": "steps/key-note/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 61.1,
        "y": 87.7
      },
      "frame": "steps/key-note/2.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Compare with page four.",
      "frame": "steps/key-note/3.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Enter",
      "frame": "steps/key-note/4.jpg"
    }
  ],
  "key-noteKeys": [
    {
      "action": "hover",
      "at": {
        "x": 48.8,
        "y": 89.9
      },
      "frame": "steps/key-noteKeys/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 48.8,
        "y": 89.9
      },
      "frame": "steps/key-noteKeys/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Two readings,",
      "frame": "steps/key-noteKeys/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Shift+Enter",
      "frame": "steps/key-noteKeys/3.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Enter",
      "frame": "steps/key-noteKeys/4.jpg"
    }
  ],
  "key-palette": [
    {
      "action": "hover",
      "at": {
        "x": 41.7,
        "y": 55.5
      },
      "frame": "steps/key-palette/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 55.5
      },
      "keys": "F",
      "frame": "steps/key-palette/1.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 55.5
      },
      "keys": "T",
      "frame": "steps/key-palette/2.jpg"
    }
  ],
  "key-pen": [
    {
      "action": "hover",
      "at": {
        "x": 40.9,
        "y": 84.4
      },
      "frame": "steps/key-pen/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 40.9,
        "y": 84.4
      },
      "keys": "P",
      "frame": "steps/key-pen/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 40.9,
        "y": 84.4
      },
      "to": {
        "x": 60.6,
        "y": 84.4
      },
      "frame": "steps/key-pen/2.jpg"
    }
  ],
  "key-selectErase": [
    {
      "action": "hover",
      "at": {
        "x": 48.7,
        "y": 65.6
      },
      "frame": "steps/key-selectErase/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 48.7,
        "y": 65.6
      },
      "keys": "V",
      "frame": "steps/key-selectErase/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 48.7,
        "y": 65.6
      },
      "frame": "steps/key-selectErase/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 48.7,
        "y": 65.6
      },
      "keys": "E",
      "frame": "steps/key-selectErase/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 48.7,
        "y": 85.7
      },
      "frame": "steps/key-selectErase/4.jpg"
    }
  ],
  "key-strike": [
    {
      "action": "hover",
      "at": {
        "x": 45.3,
        "y": 49
      },
      "frame": "steps/key-strike/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 45.3,
        "y": 49
      },
      "keys": "S",
      "frame": "steps/key-strike/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 45.3,
        "y": 49
      },
      "to": {
        "x": 61.2,
        "y": 49
      },
      "frame": "steps/key-strike/2.jpg"
    }
  ],
  "key-theme": [
    {
      "action": "hover",
      "at": {
        "x": 57.1,
        "y": 52.2
      },
      "frame": "steps/key-theme/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 57.1,
        "y": 52.2
      },
      "keys": "H",
      "frame": "steps/key-theme/1.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 57.1,
        "y": 52.2
      },
      "keys": "2",
      "frame": "steps/key-theme/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 57.1,
        "y": 52.2
      },
      "to": {
        "x": 44.2,
        "y": 55.4
      },
      "frame": "steps/key-theme/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 66.4,
        "y": 52.2
      },
      "frame": "steps/key-theme/4.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 66.4,
        "y": 52.2
      },
      "keys": "3",
      "frame": "steps/key-theme/5.jpg"
    }
  ],
  "key-turn": [
    {
      "action": "hover",
      "at": {
        "x": 41.7,
        "y": 59.3
      },
      "frame": "steps/key-turn/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 59.3
      },
      "keys": "→",
      "frame": "steps/key-turn/1.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 59.3
      },
      "keys": "→",
      "frame": "steps/key-turn/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 41.7,
        "y": 59.3
      },
      "keys": "←",
      "frame": "steps/key-turn/3.jpg"
    }
  ],
  "key-underline": [
    {
      "action": "hover",
      "at": {
        "x": 67.3,
        "y": 45.8
      },
      "frame": "steps/key-underline/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 67.3,
        "y": 45.8
      },
      "keys": "U",
      "frame": "steps/key-underline/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 67.3,
        "y": 45.8
      },
      "to": {
        "x": 77.2,
        "y": 45.8
      },
      "frame": "steps/key-underline/2.jpg"
    }
  ],
  "key-undo": [
    {
      "action": "hover",
      "at": {
        "x": 47.7,
        "y": 33.8
      },
      "frame": "steps/key-undo/0.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 47.7,
        "y": 33.8
      },
      "keys": "H",
      "frame": "steps/key-undo/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 47.7,
        "y": 33.8
      },
      "to": {
        "x": 70,
        "y": 33.8
      },
      "frame": "steps/key-undo/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 47.7,
        "y": 33.8
      },
      "keys": "Mod+Z",
      "frame": "steps/key-undo/3.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 47.7,
        "y": 33.8
      },
      "keys": "Mod+Shift+Z",
      "frame": "steps/key-undo/4.jpg"
    }
  ],
  "links": [
    {
      "action": "hover",
      "at": {
        "x": 33,
        "y": 40.8
      },
      "frame": "steps/links/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 33,
        "y": 40.8
      },
      "frame": "steps/links/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 92.1,
        "y": 41.4
      },
      "frame": "steps/links/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 80.7,
        "y": 58.1
      },
      "frame": "steps/links/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 79.5,
        "y": 49.6
      },
      "frame": "steps/links/4.jpg"
    }
  ],
  "margin": [
    {
      "action": "hover",
      "at": {
        "x": 26,
        "y": 81.8
      },
      "frame": "steps/margin/0.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 26,
        "y": 81.8
      },
      "to": {
        "x": 34,
        "y": 81.8
      },
      "frame": "steps/margin/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 79.7,
        "y": 90.8
      },
      "frame": "steps/margin/2.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 56.4
      },
      "keys": "Read the way the poem asks: twice.",
      "frame": "steps/margin/3.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 56.4
      },
      "keys": "Enter",
      "frame": "steps/margin/4.jpg"
    },
    {
      "action": "hover",
      "at": {
        "x": 85,
        "y": 89.5
      },
      "frame": "steps/margin/5.jpg"
    }
  ],
  "markspanel": [
    {
      "action": "hover",
      "at": {
        "x": 95.5,
        "y": 9.6
      },
      "frame": "steps/markspanel/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 95.5,
        "y": 9.6
      },
      "frame": "steps/markspanel/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 82.4,
        "y": 26.5
      },
      "frame": "steps/markspanel/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 87.6,
        "y": 55.8
      },
      "frame": "steps/markspanel/3.jpg"
    }
  ],
  "motif": [
    {
      "action": "hover",
      "at": {
        "x": 66.7,
        "y": 50
      },
      "frame": "steps/motif/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 66.7,
        "y": 50
      },
      "frame": "steps/motif/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50.9,
        "y": 54.4
      },
      "keys": "moon, sea",
      "frame": "steps/motif/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 66.7,
        "y": 54.5
      },
      "frame": "steps/motif/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 49.8,
        "y": 54.2
      },
      "frame": "steps/motif/4.jpg"
    }
  ],
  "ocr": [
    {
      "action": "hover",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/ocr/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/ocr/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 62,
        "y": 33.1
      },
      "to": {
        "x": 79.5,
        "y": 33.1
      },
      "frame": "steps/ocr/2.jpg"
    },
    {
      "action": "hover",
      "at": {
        "x": 72.1,
        "y": 36.3
      },
      "frame": "steps/ocr/3.jpg"
    }
  ],
  "overlap": [
    {
      "action": "hover",
      "at": {
        "x": 47.1,
        "y": 46.5
      },
      "frame": "steps/overlap/0.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 47.1,
        "y": 46.5
      },
      "to": {
        "x": 59.4,
        "y": 46.5
      },
      "frame": "steps/overlap/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 85.1,
        "y": 46.8
      },
      "frame": "steps/overlap/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 76.5,
        "y": 51
      },
      "frame": "steps/overlap/3.jpg"
    },
    {
      "action": "hover",
      "at": {
        "x": 54.7,
        "y": 46.5
      },
      "frame": "steps/overlap/4.jpg"
    }
  ],
  "pdfgrid": [
    {
      "action": "hover",
      "at": {
        "x": 75.1,
        "y": 9.3
      },
      "frame": "steps/pdfgrid/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 75.1,
        "y": 9.3
      },
      "frame": "steps/pdfgrid/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 70.2,
        "y": 15.6
      },
      "frame": "steps/pdfgrid/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 49.7,
        "y": 76.5
      },
      "frame": "steps/pdfgrid/3.jpg"
    }
  ],
  "pdftools": [
    {
      "action": "hover",
      "at": {
        "x": 33.5,
        "y": 8.9
      },
      "frame": "steps/pdftools/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 33.5,
        "y": 8.9
      },
      "frame": "steps/pdftools/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 58.9
      },
      "to": {
        "x": 58.6,
        "y": 58.9
      },
      "frame": "steps/pdftools/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 40.5,
        "y": 8.9
      },
      "frame": "steps/pdftools/3.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 37.7,
        "y": 30.2
      },
      "to": {
        "x": 79.5,
        "y": 42.5
      },
      "frame": "steps/pdftools/4.jpg"
    }
  ],
  "poetry": [
    {
      "action": "hover",
      "at": {
        "x": 37,
        "y": 16.7
      },
      "frame": "steps/poetry/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 37,
        "y": 16.7
      },
      "frame": "steps/poetry/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 96.2,
        "y": 28.5
      },
      "frame": "steps/poetry/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 79.2,
        "y": 36.1
      },
      "frame": "steps/poetry/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 95.9,
        "y": 24.3
      },
      "frame": "steps/poetry/4.jpg"
    }
  ],
  "popover": [
    {
      "action": "hover",
      "at": {
        "x": 53.7,
        "y": 44.8
      },
      "frame": "steps/popover/0.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 53.7,
        "y": 44.8
      },
      "to": {
        "x": 25.7,
        "y": 48.7
      },
      "frame": "steps/popover/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 78.5,
        "y": 45.1
      },
      "frame": "steps/popover/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 76.5,
        "y": 49.3
      },
      "frame": "steps/popover/3.jpg"
    }
  ],
  "reader": [
    {
      "action": "hover",
      "at": {
        "x": 68.6,
        "y": 16.7
      },
      "frame": "steps/reader/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 68.6,
        "y": 16.7
      },
      "frame": "steps/reader/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 40.3,
        "y": 40.8
      },
      "to": {
        "x": 58.2,
        "y": 40.8
      },
      "frame": "steps/reader/2.jpg"
    }
  ],
  "search": [
    {
      "action": "hover",
      "at": {
        "x": 8.6,
        "y": 33.3
      },
      "frame": "steps/search/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 8.6,
        "y": 33.3
      },
      "frame": "steps/search/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 49.8,
        "y": 11.6
      },
      "keys": "moon",
      "frame": "steps/search/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 50,
        "y": 29.5
      },
      "frame": "steps/search/3.jpg"
    }
  ],
  "shelf": [
    {
      "action": "hover",
      "at": {
        "x": 55.4,
        "y": 61.2
      },
      "frame": "steps/shelf/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 55.4,
        "y": 58.7
      },
      "frame": "steps/shelf/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 65.8,
        "y": 67.1
      },
      "frame": "steps/shelf/2.jpg"
    }
  ],
  "spread": [
    {
      "action": "hover",
      "at": {
        "x": 91.6,
        "y": 16.7
      },
      "frame": "steps/spread/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 91.6,
        "y": 16.7
      },
      "frame": "steps/spread/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 96.6,
        "y": 59.6
      },
      "frame": "steps/spread/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 96.6,
        "y": 59.6
      },
      "keys": "→",
      "frame": "steps/spread/3.jpg"
    }
  ],
  "tagging": [
    {
      "action": "hover",
      "at": {
        "x": 43,
        "y": 2.3
      },
      "frame": "steps/tagging/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 43,
        "y": 2.3
      },
      "frame": "steps/tagging/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 68.6,
        "y": 16.7
      },
      "frame": "steps/tagging/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 23.8,
        "y": 40.8
      },
      "to": {
        "x": 50.7,
        "y": 40.8
      },
      "frame": "steps/tagging/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 35.9,
        "y": 2.3
      },
      "frame": "steps/tagging/4.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 23.8,
        "y": 61.2
      },
      "to": {
        "x": 43.3,
        "y": 61.2
      },
      "frame": "steps/tagging/5.jpg"
    }
  ],
  "terminology": [
    {
      "action": "hover",
      "at": {
        "x": 26.4,
        "y": 81.6
      },
      "frame": "steps/terminology/0.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 26.4,
        "y": 81.6
      },
      "to": {
        "x": 38.7,
        "y": 81.6
      },
      "frame": "steps/terminology/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 84,
        "y": 86.2
      },
      "frame": "steps/terminology/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 8.6,
        "y": 18.3
      },
      "frame": "steps/terminology/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 87.9,
        "y": 5.7
      },
      "frame": "steps/terminology/4.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 56.1,
        "y": 23.3
      },
      "frame": "steps/terminology/5.jpg"
    }
  ],
  "thememanager": [
    {
      "action": "hover",
      "at": {
        "x": 76.6,
        "y": 6.3
      },
      "frame": "steps/thememanager/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 76.6,
        "y": 6.3
      },
      "frame": "steps/thememanager/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 58.6,
        "y": 54.7
      },
      "keys": "Ethics",
      "frame": "steps/thememanager/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 52.8,
        "y": 50
      },
      "frame": "steps/thememanager/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 75.5,
        "y": 50
      },
      "frame": "steps/thememanager/4.jpg"
    }
  ],
  "tool-addnote": [
    {
      "action": "hover",
      "at": {
        "x": 31.6,
        "y": 16.7
      },
      "frame": "steps/tool-addnote/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 31.6,
        "y": 16.7
      },
      "frame": "steps/tool-addnote/1.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 56.4
      },
      "keys": "A letter, not a lecture.",
      "frame": "steps/tool-addnote/2.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 56.4
      },
      "keys": "Enter",
      "frame": "steps/tool-addnote/3.jpg"
    }
  ],
  "tool-area": [
    {
      "action": "hover",
      "at": {
        "x": 23.6,
        "y": 8.9
      },
      "frame": "steps/tool-area/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 23.6,
        "y": 8.9
      },
      "frame": "steps/tool-area/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 40.8
      },
      "to": {
        "x": 78.3,
        "y": 87.7
      },
      "frame": "steps/tool-area/2.jpg"
    }
  ],
  "tool-arrow": [
    {
      "action": "hover",
      "at": {
        "x": 45.2,
        "y": 8.9
      },
      "frame": "steps/tool-arrow/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 45.2,
        "y": 8.9
      },
      "frame": "steps/tool-arrow/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 80.7,
        "y": 65.4
      },
      "to": {
        "x": 77.8,
        "y": 46.5
      },
      "frame": "steps/tool-arrow/2.jpg"
    }
  ],
  "tool-bracket": [
    {
      "action": "hover",
      "at": {
        "x": 49.9,
        "y": 8.9
      },
      "frame": "steps/tool-bracket/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 49.9,
        "y": 8.9
      },
      "frame": "steps/tool-bracket/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 68.6,
        "y": 15.5
      },
      "frame": "steps/tool-bracket/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 79.8,
        "y": 44.4
      },
      "to": {
        "x": 81,
        "y": 57.6
      },
      "frame": "steps/tool-bracket/3.jpg"
    }
  ],
  "tool-collapse": [
    {
      "action": "hover",
      "at": {
        "x": 88.9,
        "y": 16.7
      },
      "frame": "steps/tool-collapse/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 88.9,
        "y": 16.7
      },
      "frame": "steps/tool-collapse/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 43.4,
        "y": 63.1
      },
      "frame": "steps/tool-collapse/2.jpg"
    }
  ],
  "tool-ellipse": [
    {
      "action": "hover",
      "at": {
        "x": 42.9,
        "y": 8.9
      },
      "frame": "steps/tool-ellipse/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 42.9,
        "y": 8.9
      },
      "frame": "steps/tool-ellipse/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 34.1,
        "y": 15.5
      },
      "frame": "steps/tool-ellipse/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 61.6,
        "y": 47.5
      },
      "to": {
        "x": 73.8,
        "y": 50.5
      },
      "frame": "steps/tool-ellipse/3.jpg"
    }
  ],
  "tool-erase": [
    {
      "action": "hover",
      "at": {
        "x": 57.5,
        "y": 8.9
      },
      "frame": "steps/tool-erase/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 57.5,
        "y": 8.9
      },
      "frame": "steps/tool-erase/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 48.7,
        "y": 71.2
      },
      "frame": "steps/tool-erase/2.jpg"
    }
  ],
  "tool-highlight": [
    {
      "action": "hover",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/tool-highlight/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/tool-highlight/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 33.8
      },
      "to": {
        "x": 63,
        "y": 33.8
      },
      "frame": "steps/tool-highlight/2.jpg"
    }
  ],
  "tool-inkarrow": [
    {
      "action": "hover",
      "at": {
        "x": 35.9,
        "y": 8.9
      },
      "frame": "steps/tool-inkarrow/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 35.9,
        "y": 8.9
      },
      "frame": "steps/tool-inkarrow/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 27.1,
        "y": 15.5
      },
      "frame": "steps/tool-inkarrow/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 41.7,
        "y": 15.5
      },
      "frame": "steps/tool-inkarrow/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 51.8,
        "y": 15.5
      },
      "frame": "steps/tool-inkarrow/4.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 76.3,
        "y": 85.5
      },
      "to": {
        "x": 49.4,
        "y": 57.1
      },
      "frame": "steps/tool-inkarrow/5.jpg"
    }
  ],
  "tool-line": [
    {
      "action": "hover",
      "at": {
        "x": 47.6,
        "y": 8.9
      },
      "frame": "steps/tool-line/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 47.6,
        "y": 8.9
      },
      "frame": "steps/tool-line/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.7,
        "y": 59.8
      },
      "to": {
        "x": 78.3,
        "y": 59.8
      },
      "frame": "steps/tool-line/2.jpg"
    }
  ],
  "tool-more": [
    {
      "action": "hover",
      "at": {
        "x": 77,
        "y": 9.3
      },
      "frame": "steps/tool-more/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 77,
        "y": 9.3
      },
      "frame": "steps/tool-more/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 60.4,
        "y": 15.6
      },
      "frame": "steps/tool-more/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 72,
        "y": 15.6
      },
      "frame": "steps/tool-more/3.jpg"
    }
  ],
  "tool-note": [
    {
      "action": "hover",
      "at": {
        "x": 52.8,
        "y": 8.9
      },
      "frame": "steps/tool-note/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 52.8,
        "y": 8.9
      },
      "frame": "steps/tool-note/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 64.1,
        "y": 15.5
      },
      "frame": "steps/tool-note/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 58.6,
        "y": 74.3
      },
      "frame": "steps/tool-note/3.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Answer it, line by line.",
      "frame": "steps/tool-note/4.jpg"
    },
    {
      "action": "key",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Enter",
      "frame": "steps/tool-note/5.jpg"
    }
  ],
  "tool-notes": [
    {
      "action": "hover",
      "at": {
        "x": 24.5,
        "y": 12
      },
      "frame": "steps/tool-notes/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 24.5,
        "y": 12
      },
      "frame": "steps/tool-notes/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 24.5,
        "y": 12
      },
      "frame": "steps/tool-notes/2.jpg"
    }
  ],
  "tool-pen": [
    {
      "action": "hover",
      "at": {
        "x": 33.5,
        "y": 8.9
      },
      "frame": "steps/tool-pen/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 33.5,
        "y": 8.9
      },
      "frame": "steps/tool-pen/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 21,
        "y": 15.5
      },
      "frame": "steps/tool-pen/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 39.4,
        "y": 15.5
      },
      "frame": "steps/tool-pen/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 47.1,
        "y": 15.5
      },
      "frame": "steps/tool-pen/4.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 58.9
      },
      "to": {
        "x": 58.6,
        "y": 58.9
      },
      "frame": "steps/tool-pen/5.jpg"
    }
  ],
  "tool-rect": [
    {
      "action": "hover",
      "at": {
        "x": 40.5,
        "y": 8.9
      },
      "frame": "steps/tool-rect/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 40.5,
        "y": 8.9
      },
      "frame": "steps/tool-rect/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 29.9,
        "y": 15.5
      },
      "frame": "steps/tool-rect/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 48.4,
        "y": 15.5
      },
      "frame": "steps/tool-rect/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 54.1,
        "y": 15.5
      },
      "frame": "steps/tool-rect/4.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 37.7,
        "y": 30.2
      },
      "to": {
        "x": 79.5,
        "y": 42.5
      },
      "frame": "steps/tool-rect/5.jpg"
    }
  ],
  "tool-select": [
    {
      "action": "hover",
      "at": {
        "x": 18.9,
        "y": 8.9
      },
      "frame": "steps/tool-select/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 18.9,
        "y": 8.9
      },
      "frame": "steps/tool-select/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 37.9,
        "y": 76.5
      },
      "frame": "steps/tool-select/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 56.3,
        "y": 64.6
      },
      "frame": "steps/tool-select/3.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 37.9,
        "y": 76.5
      },
      "to": {
        "x": 37.9,
        "y": 51.1
      },
      "frame": "steps/tool-select/4.jpg"
    }
  ],
  "tool-strikeout": [
    {
      "action": "hover",
      "at": {
        "x": 28.3,
        "y": 8.9
      },
      "frame": "steps/tool-strikeout/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 28.3,
        "y": 8.9
      },
      "frame": "steps/tool-strikeout/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 40.2
      },
      "to": {
        "x": 60.4,
        "y": 40.2
      },
      "frame": "steps/tool-strikeout/2.jpg"
    }
  ],
  "tool-text": [
    {
      "action": "hover",
      "at": {
        "x": 55.2,
        "y": 8.9
      },
      "frame": "steps/tool-text/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 55.2,
        "y": 8.9
      },
      "frame": "steps/tool-text/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 56.6,
        "y": 15.5
      },
      "frame": "steps/tool-text/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 71
      },
      "to": {
        "x": 64.5,
        "y": 81
      },
      "frame": "steps/tool-text/3.jpg"
    },
    {
      "action": "type",
      "at": {
        "x": 50,
        "y": 49
      },
      "keys": "Read this twice, then once more.",
      "frame": "steps/tool-text/4.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 61.1,
        "y": 60.2
      },
      "frame": "steps/tool-text/5.jpg"
    }
  ],
  "tool-underline": [
    {
      "action": "hover",
      "at": {
        "x": 25.9,
        "y": 8.9
      },
      "frame": "steps/tool-underline/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 25.9,
        "y": 8.9
      },
      "frame": "steps/tool-underline/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 11.6,
        "y": 15.5
      },
      "frame": "steps/tool-underline/2.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 46.3,
        "y": 37
      },
      "to": {
        "x": 63.9,
        "y": 37
      },
      "frame": "steps/tool-underline/3.jpg"
    }
  ],
  "tool-undo": [
    {
      "action": "hover",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/tool-undo/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 21.3,
        "y": 8.9
      },
      "frame": "steps/tool-undo/1.jpg"
    },
    {
      "action": "drag",
      "at": {
        "x": 38.9,
        "y": 45.8
      },
      "to": {
        "x": 61.5,
        "y": 45.8
      },
      "frame": "steps/tool-undo/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 60.5,
        "y": 9.6
      },
      "frame": "steps/tool-undo/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 63.2,
        "y": 9.6
      },
      "frame": "steps/tool-undo/4.jpg"
    }
  ],
  "tracker": [
    {
      "action": "hover",
      "at": {
        "x": 81.2,
        "y": 3.8
      },
      "frame": "steps/tracker/0.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 81.2,
        "y": 3.8
      },
      "frame": "steps/tracker/1.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 43.7,
        "y": 26.8
      },
      "frame": "steps/tracker/2.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 87.9,
        "y": 3.8
      },
      "frame": "steps/tracker/3.jpg"
    },
    {
      "action": "click",
      "at": {
        "x": 56.1,
        "y": 21.4
      },
      "frame": "steps/tracker/4.jpg"
    }
  ]
};
