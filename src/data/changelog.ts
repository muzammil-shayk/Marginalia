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

export const CURRENT_APP_VERSION = '2.3.1';

export const CHANGELOG_RELEASES: ReleaseNote[] = [
  {
    version: '2.3.1',
    title: 'A Shelf That Fits',
    date: 'October 2026',
    summary:
      'The bookshelf now matches your theme and fills your window, books open and shelve more gently, and Windows updates get smaller.',
    highlights: [
      {
        category: 'improvement',
        title: 'A shelf that matches your theme',
        description:
          'Cream in light mode; in dark mode, dark, with a warm wooden plank and a gold edge. On wide windows the books grow to fill the shelf. On phones the shelf fades at the edge to show there are more books, and snaps from book to book.'
      },
      {
        category: 'improvement',
        title: 'Opening and shelving, unhurried',
        description:
          'Each takes about a second and a half. The page scrolls along with the book, so you see it land on the desk and go back into its slot. Scroll or press a key and the auto-scroll stops.'
      },
      {
        category: 'improvement',
        title: 'A real first page for every book',
        description:
          'Text, web and EPUB books now open on the desk to their opening lines on paper, not a blank page.'
      },
      {
        category: 'improvement',
        title: 'Home and navigation',
        description:
          'Home puts your shelf first, with Knowledge Studio below it. The selected tab is a soft sage-green pill in light mode and a clear cream pill in dark mode. In dark mode the logo sits fully on its cream plate.'
      },
      {
        category: 'fix',
        title: 'Smaller fixes',
        description:
          'The gold focus ring appears only when you navigate with the keyboard, not after a mouse click. Search results start and end on whole words. The reader\'s tag strip has more room and a quieter scrollbar. The sidebar shows the full credit. The Windows update window uses the right font weight.'
      },
      {
        category: 'improvement',
        title: 'Smaller updates on Windows',
        description:
          'Future updates on Windows download only what changed, so they are smaller and faster.'
      }
    ]
  },
  {
    version: '2.3.0',
    title: 'The Bookshelf, and a Quieter Look',
    date: 'October 2026',
    summary:
      'Your library is now a shelf of books, the whole app wears one new look, and updates announce themselves.',
    highlights: [
      {
        category: 'feature',
        title: 'A bookshelf for your library',
        description:
          'Home shows your documents as book spines on a shelf. Hover a spine and it lifts, with its title written above. Click a book and it slides onto a desk below, open at its first page; Read takes it into the reader. Shelve it, or Esc, puts it back, and Previous and Next move along the shelf. Arrow keys work too. Titles always fit their spines, and a book with notes carries a gold ribbon. The list view is still there.'
      },
      {
        category: 'feature',
        title: 'Update prompts',
        description:
          'Marginalia now tells you when an update is ready, with Restart now or Later, in a window styled for Mac or Windows. Later is remembered for that version, even after a restart. Check for updates in Settings now says when you are up to date, and Version History opens these notes.'
      },
      {
        category: 'improvement',
        title: 'One look across the app',
        description:
          'Cream, ink and gold, with handwritten titles and small-caps labels, across navigation, Settings, Upload, the reader toolbar and panels, and dialogs. Light and dark themes both follow it, and the text is easier to read.'
      },
      {
        category: 'improvement',
        title: 'Motion that eases',
        description:
          'No more springy or bouncy animation. Everything now eases into place.'
      },
      {
        category: 'fix',
        title: 'Settings are saved more safely',
        description:
          'A damaged settings file no longer stops Marginalia from saving; the old copy is kept aside. And if your library moves but the new location cannot be saved, you now see an error, instead of an empty library after the next restart.'
      }
    ]
  },
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

