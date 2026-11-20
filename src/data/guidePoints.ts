/**
 * Made by scripts/capture-guide.cjs with the pictures: where each toolbar card's pointer clicks the
 * tool, then the mark it made, in percent of the picture. Do not edit by hand; re-run
 * `npm run guide:capture`.
 */

export const GUIDE_POINTS: Record<string, { tool?: { x: number; y: number }; focus: { x: number; y: number } }> = {
  "tool-inkarrow": {
    "tool": {
      "x": 35.9,
      "y": 8.9
    },
    "focus": {
      "x": 49.6,
      "y": 61.5
    }
  },
  "tool-area": {
    "tool": {
      "x": 23.6,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 63.2
    }
  },
  "find": {
    "focus": {
      "x": 29.5,
      "y": 66.7
    }
  },
  "focus": {
    "focus": {
      "x": 2.9,
      "y": 50
    }
  },
  "ocr": {
    "focus": {
      "x": 58.6,
      "y": 24.8
    }
  },
  "tool-select": {
    "tool": {
      "x": 18.9,
      "y": 8.9
    },
    "focus": {
      "x": 37.9,
      "y": 57.6
    }
  },
  "tool-highlight": {
    "tool": {
      "x": 21.3,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 33.6
    }
  },
  "tool-underline": {
    "tool": {
      "x": 25.9,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 37.6
    }
  },
  "tool-strikeout": {
    "tool": {
      "x": 28.3,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 36.8
    }
  },
  "tool-pen": {
    "tool": {
      "x": 33.5,
      "y": 8.9
    },
    "focus": {
      "x": 56.1,
      "y": 71
    }
  },
  "tool-rect": {
    "tool": {
      "x": 40.5,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 52
    }
  },
  "tool-ellipse": {
    "tool": {
      "x": 42.9,
      "y": 8.9
    },
    "focus": {
      "x": 57.1,
      "y": 33.6
    }
  },
  "tool-arrow": {
    "tool": {
      "x": 45.2,
      "y": 8.9
    },
    "focus": {
      "x": 64.5,
      "y": 58.7
    }
  },
  "tool-line": {
    "tool": {
      "x": 47.6,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 68.5
    }
  },
  "tool-bracket": {
    "tool": {
      "x": 49.9,
      "y": 8.9
    },
    "focus": {
      "x": 36.9,
      "y": 58.1
    }
  },
  "tool-note": {
    "tool": {
      "x": 52.8,
      "y": 8.9
    },
    "focus": {
      "x": 50,
      "y": 49
    }
  },
  "tool-text": {
    "tool": {
      "x": 55.2,
      "y": 8.9
    },
    "focus": {
      "x": 48.8,
      "y": 76
    }
  },
  "tool-erase": {
    "tool": {
      "x": 57.5,
      "y": 8.9
    },
    "focus": {
      "x": 55.1,
      "y": 71.5
    }
  },
  "blackout": {
    "tool": {
      "x": 38.2,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 36.7
    }
  },
  "tool-undo": {
    "focus": {
      "x": 60.5,
      "y": 9.6
    }
  },
  "tool-more": {
    "focus": {
      "x": 61.4,
      "y": 15.6
    }
  },
  "tool-addnote": {
    "tool": {
      "x": 31.6,
      "y": 16.7
    },
    "focus": {
      "x": 50,
      "y": 56.4
    }
  },
  "tool-collapse": {
    "tool": {
      "x": 88.9,
      "y": 16.7
    },
    "focus": {
      "x": 43.4,
      "y": 63.1
    }
  },
  "tool-notes": {
    "tool": {
      "x": 24.5,
      "y": 12
    },
    "focus": {
      "x": 79.7,
      "y": 83.1
    }
  }
};
