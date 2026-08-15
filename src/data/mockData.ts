import { Book, StickyNote, ThemeInsight, MetaphorPattern, UserSettings } from '../types';

export const initialSettings: UserSettings = {
  name: 'Eleanor James',
  email: 'eleanor.james@example.com',
  subscription: 'Marginalia Pro',
  typography: 'Literata (Default)',
  fontSize: 18,
  darkMode: false,
  readerMode: false,
  activeThemes: [
    { id: '1', name: 'Metaphors of Illness', color: '#f87171' },
    { id: '2', name: 'Borders & Migration', color: '#38bdf8' },
    { id: '3', name: 'Domesticity', color: '#c084fc' }
  ]
};

export const currentBook: Book = {
  id: 'arch-complexity',
  title: 'The Architecture of Complexity',
  author: 'Herbert A. Simon',
  chapter: 'Chapter 4: Nearly Decomposable Systems',
  currentPage: 142,
  totalPages: 320,
  progressPercent: 44,
  category: 'SYSTEMS THEORY',
  tagText: 'IN PROGRESS',
  annotationsCount: 28,
  coverGradient: 'from-stone-700 to-stone-900'
};

export const libraryBooks: Book[] = [
  {
    id: 'phenom-perception',
    title: 'Phenomenology of Perception',
    author: 'Maurice Merleau-Ponty',
    category: 'PHILOSOPHY',
    tagText: 'PHILOSOPHY',
    isNew: true,
    coverGradient: 'from-sky-200 via-slate-300 to-blue-200',
    coverImage: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=200&q=80'
  },
  {
    id: 'poetics-space',
    title: 'The Poetics of Space',
    author: 'Gaston Bachelard',
    category: 'ARCHITECTURE',
    tagText: 'ARCHITECTURE',
    annotationsCount: 14,
    coverGradient: 'from-amber-100 via-stone-200 to-emerald-100',
    coverImage: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=200&q=80'
  }
];

export const extractedThemes: ThemeInsight[] = [
  {
    id: 't1',
    title: 'Hierarchical Systems',
    description: 'The author repeatedly emphasizes how complex structures are built from stable, intermediate sub-systems.',
    confidence: 94,
    confidenceLabel: 'High Confidence (94%)',
    mentions: 28,
    selected: true,
    color: '#6366f1'
  },
  {
    id: 't2',
    title: 'Evolutionary Adaptation',
    description: 'Focuses on how biological and artificial systems adapt to environmental pressures over time.',
    confidence: 76,
    confidenceLabel: 'Medium Confidence (76%)',
    mentions: 14,
    selected: false,
    color: '#3b82f6'
  },
  {
    id: 't3',
    title: 'Modular Decomposability',
    description: 'Intra-component interactions are distinctly stronger and faster than inter-component interactions.',
    confidence: 88,
    confidenceLabel: 'High Confidence (88%)',
    mentions: 19,
    selected: false,
    color: '#10b981'
  }
];

export const metaphorPatterns: MetaphorPattern[] = [
  { name: 'Watchmaker', percentage: 85, colorClass: 'bg-[#e2d9f3]' },
  { name: 'Alphabet', percentage: 40, colorClass: 'bg-[#d1fae5]' },
  { name: 'Tapestry', percentage: 25, colorClass: 'bg-[#e5e7eb]' }
];

export const recentDocuments = [
  {
    id: 'doc-1',
    title: 'Meditations on First Philosophy',
    format: 'PDF',
    timeAgo: 'Added 2 days ago',
    iconColor: 'bg-purple-100 text-purple-600'
  },
  {
    id: 'doc-2',
    title: 'The Architecture of Happiness...',
    format: 'Text',
    timeAgo: 'Added last week',
    iconColor: 'bg-emerald-100 text-emerald-700'
  },
  {
    id: 'doc-3',
    title: 'Critique of Pure Reason Excerpts',
    format: 'DOCX',
    timeAgo: 'Added 3 weeks ago',
    iconColor: 'bg-amber-100 text-amber-700'
  }
];

export const sampleReaderParagraphs = [
  {
    id: 'p1',
    text: "A complex system is made up of a large number of parts that interact in a non-simple way. In such systems, the whole is more than the sum of the parts, not in an ultimate, metaphysical sense, but in the important pragmatic sense that, given the properties of the parts and the laws of their interaction, it is not a trivial matter to infer the properties of the whole."
  },
  {
    id: 'p2',
    text: "Hierarchy, frequently taken as a hallmark of complex systems, refers to a system composed of interrelated subsystems, each of the latter being in turn hierarchic in structure until we reach some lowest level of elementary subsystem."
  },
  {
    id: 'p3',
    text: "Let us consider the parable of the two watchmakers, Hora and Tempus. Both made very fine watches, consisting of about a thousand parts each. Tempus constructed his watches in such a way that if he had partly assembled one and had to put it down—to answer the phone, say—it immediately fell into pieces and had to be reassembled from the elements."
  },
  {
    id: 'p4',
    text: "Hora, on the other hand, designed his watches so that he could put together subassemblies of about ten components each. Ten of these subassemblies, again, could be fitted together into a larger subassembly; and a system of ten of the latter constituted the whole watch. Hence, when Hora was interrupted, he lost only a small part of his work, and he assembled his watches in a fraction of the time required by Tempus."
  },
  {
    id: 'p5',
    text: "In nearly decomposable systems, the short-run behavior of each of the component subsystems is approximately independent of the short-run behavior of the other components. In the long run, the behavior of any one of the components depends in only an aggregate way on the behavior of the other components."
  },
  {
    id: 'p6',
    text: "The time required for the evolution of a complex form from simple elements depends critically on the numbers and distribution of potential intermediate stable forms. Without hierarchy, the emergence of complex biological and social orders would have required durations far exceeding the known age of the universe."
  }
];

export const initialStickyNotes: StickyNote[] = [
  {
    id: 'note-1',
    paragraphIndex: 2,
    color: 'yellow',
    title: 'Watchmaker Metaphor',
    content: 'Hora represents modular assembly with stable sub-assemblies. The resistance to external disturbance is the central evolutionary advantage.',
    author: 'Eleanor J.',
    timestamp: 'Yesterday at 4:12 PM',
    themeTag: 'Hierarchical Systems',
    quote: 'Hora designed his watches so that he could put together subassemblies of about ten components each.'
  },
  {
    id: 'note-2',
    paragraphIndex: 4,
    color: 'purple',
    title: 'Time-Scale Separation',
    content: 'Notice how high frequency dynamics stay within modules, while low frequency dynamics govern macro interactions. Direct bridge to neural architecture.',
    author: 'Marginalia AI',
    timestamp: 'Oct 24, 2023',
    themeTag: 'Modular Decomposability',
    quote: 'the short-run behavior of each of the component subsystems is approximately independent...'
  },
  {
    id: 'note-3',
    paragraphIndex: 0,
    color: 'teal',
    title: 'Pragmatic Emergence',
    content: 'Simon distinguishes between mystical holism and computable non-linear interactions.',
    author: 'Eleanor J.',
    timestamp: 'Oct 22, 2023',
    themeTag: 'Hierarchical Systems'
  }
];
