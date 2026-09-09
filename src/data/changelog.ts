/**
 * Structured changelog and release notes for Marginalia.
 *
 * Used by the first-launch update modal and the Settings screen.
 * Follows the minimalist-ui and editorial guidelines: clear plain language,
 * meaningful categorized items, and zero generic boilerplate.
 */

export type ChangelogCategory = 'feature' | 'improvement' | 'fix';

export interface ChangelogItem {
  category: ChangelogCategory;
  title: string;
  description: string;
}

export interface ReleaseNote {
  version: string;
  title: string;
  date: string;
  summary: string;
  highlights: ChangelogItem[];
}

export const CURRENT_APP_VERSION = '2.2.0';

export const CHANGELOG_RELEASES: ReleaseNote[] = [
  {
    version: '2.2.0',
    title: 'What Changed, and Where Things Are Kept',
    date: 'September 2026',
    summary:
      'This dialog, for one — plus the fixes behind it, all of them about the app remembering things properly across a restart.',
    highlights: [
      {
        category: 'feature',
        title: 'Release notes on first launch',
        description:
          'A short account of what changed, shown once after an update and reachable any time from Settings under About.'
      },
      {
        category: 'fix',
        title: 'The dialog stays dismissed',
        description:
          'Which version you have already seen is kept with your settings rather than in browser storage. The desktop app starts its own server on a new port each launch, and browser storage does not survive that — so a note kept there came back every single time you opened the app.'
      },
      {
        category: 'fix',
        title: 'Your themes survive an update',
        description:
          'A settings file that could not be read at startup looked exactly like a first launch, and the app wrote the default themes over your own. It now tells the two apart, waits for the file, and never writes settings it has not managed to read.'
      },
      {
        category: 'fix',
        title: 'The Windows taskbar icon is back',
        description:
          'The icon was never packaged with the app, so after an update Windows had nothing to draw. It now ships, at every size Windows asks for.'
      }
    ]
  },
  {
    version: '2.1.0',
    title: 'Knowledge Studio & Global Library Search',
    date: 'September 2026',
    summary:
      'A refined editorial experience for deep reading: introducing the Knowledge Studio dashboard, full-library search across notes and marks, in-app Gemini API configuration, and seamless background updates.',
    highlights: [
      {
        category: 'feature',
        title: 'The Knowledge Studio',
        description:
          'Transformed the library dashboard with an editorial Knowledge Studio: Thematic Atlas for discovering recurring conceptual motifs, Terminologies for the vocabulary you mark, and an AI Synthesis spotlight.'
      },
      {
        category: 'feature',
        title: 'Global Library Search',
        description:
          'Instant search across every document and mark in your personal library. Jump directly to any marked passage or theme definition with a single keystroke.'
      },
      {
        category: 'feature',
        title: 'Direct Gemini API Key Configuration',
        description:
          'Configure your custom Google Gemini API key directly inside Settings without restarting or modifying environment files. The key is stored on this computer, beside your library, and is sent to Google only when you ask for an analysis.'
      },
      {
        category: 'improvement',
        title: 'Subtle Fluid Bookshelf & Clean Covers',
        description:
          'Uncluttered book preview cards with flat, authentic typography, aligned metadata docking, and concept badge counts.'
      },
      {
        category: 'improvement',
        title: 'WASM PDF & EPUB Decoders',
        description:
          'Bundled WebAssembly decoders for JBIG2 and JPEG 2000 scanned documents, ensuring crisp page rendering across all formats.'
      },
      {
        category: 'fix',
        title: 'Data Integrity & Session Hydration',
        description:
          'Eliminated potential annotation race conditions during document switches and optimized local storage state restoration.'
      }
    ]
  },
  {
    version: '2.0.0',
    title: 'Fluid PDF Workspace & Phosphor Visuals',
    date: 'August 2026',
    summary:
      'A major reimagining of Marginalia: Apple-grade fluid gestures, tactile annotation tools, and Gemini-powered thematic motif detection.',
    highlights: [
      {
        category: 'feature',
        title: 'Tactile PDF Workspace',
        description:
          'A completely rebuilt PDF workspace featuring continuous document zoom, smooth page navigation, and responsive annotation highlights.'
      },
      {
        category: 'feature',
        title: 'Thematic Analysis',
        description:
          'Gemini reads a book on request and reports the themes running through it — the text itself, or a scanned book\'s page images. Nothing is sent anywhere until you press the button, and the copy is deleted as soon as the analysis returns.'
      },
      {
        category: 'improvement',
        title: 'Phosphor Iconography',
        description:
          'Migrated the interface to a cohesive, weighted Phosphor icon system tailored for high legibility on high-DPI displays.'
      },
      {
        category: 'fix',
        title: 'Single Instance Window Management',
        description:
          'Safeguarded document store against duplicate processes by focusing existing window on subsequent launches.'
      }
    ]
  }
];

export function getLatestRelease(): ReleaseNote {
  return CHANGELOG_RELEASES[0];
}

export function getReleaseByVersion(version: string): ReleaseNote {
  const clean = version.replace(/^v/, '');
  return CHANGELOG_RELEASES.find((r) => r.version === clean) || CHANGELOG_RELEASES[0];
}

