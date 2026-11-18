/**
 * Made by scripts/capture-guide.cjs with the pictures: where each toolbar card's pointer clicks the
 * tool, then the mark it made, in percent of the picture. Do not edit by hand; re-run
 * `npm run guide:capture`.
 */

export const GUIDE_POINTS: Record<string, { tool?: { x: number; y: number }; focus: { x: number; y: number } }> = {
  "tool-select": {
    "tool": {
      "x": 18.9,
      "y": 8.9
    },
    "focus": {
      "x": 37.9,
      "y": 57.4
    }
  },
  "tool-highlight": {
    "tool": {
      "x": 21.2,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 33.5
    }
  },
  "tool-underline": {
    "tool": {
      "x": 25.9,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 37.5
    }
  },
  "tool-strikeout": {
    "tool": {
      "x": 28.2,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 36.7
    }
  },
  "tool-area": {
    "tool": {
      "x": 23.6,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 57.4
    }
  },
  "tool-pen": {
    "tool": {
      "x": 33.5,
      "y": 8.9
    },
    "focus": {
      "x": 56.1,
      "y": 70.8
    }
  },
  "tool-rect": {
    "tool": {
      "x": 38.1,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 30.7
    }
  },
  "tool-ellipse": {
    "tool": {
      "x": 40.5,
      "y": 8.9
    },
    "focus": {
      "x": 57.1,
      "y": 33.5
    }
  },
  "tool-arrow": {
    "tool": {
      "x": 42.8,
      "y": 8.9
    },
    "focus": {
      "x": 64.5,
      "y": 58.5
    }
  },
  "tool-line": {
    "tool": {
      "x": 45.2,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 68.3
    }
  },
  "tool-bracket": {
    "tool": {
      "x": 47.5,
      "y": 8.9
    },
    "focus": {
      "x": 37,
      "y": 58
    }
  },
  "tool-note": {
    "tool": {
      "x": 50.4,
      "y": 8.9
    },
    "focus": {
      "x": 58.6,
      "y": 77.5
    }
  },
  "tool-text": {
    "tool": {
      "x": 52.7,
      "y": 8.9
    },
    "focus": {
      "x": 48.8,
      "y": 75.8
    }
  },
  "tool-erase": {
    "tool": {
      "x": 55.1,
      "y": 8.9
    },
    "focus": {
      "x": 55.1,
      "y": 71.3
    }
  },
  "blackout": {
    "tool": {
      "x": 35.8,
      "y": 8.9
    },
    "focus": {
      "x": 53.7,
      "y": 36.6
    }
  },
  "tool-undo": {
    "focus": {
      "x": 58.1,
      "y": 9.6
    }
  },
  "tool-more": {
    "focus": {
      "x": 63.8,
      "y": 15.6
    }
  },
  "tool-addnote": {
    "tool": {
      "x": 31.5,
      "y": 16.6
    },
    "focus": {
      "x": 50,
      "y": 56.4
    }
  },
  "tool-collapse": {
    "tool": {
      "x": 88.9,
      "y": 16.6
    },
    "focus": {
      "x": 43.4,
      "y": 63
    }
  },
  "tool-notes": {
    "tool": {
      "x": 24.4,
      "y": 12
    },
    "focus": {
      "x": 79.7,
      "y": 83.1
    }
  }
};
