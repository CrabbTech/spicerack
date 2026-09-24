// Learning paths: short, ordered sessions that each set the bench up a certain
// way and ask for one concrete thing. A step is finished by doing it — a graded
// pass with an instrument in hand where that's possible, an honest checkbox
// where it isn't. Data only; the controller knows how to stage a step.

import { ModeId } from '../theory/scales';
import { LensId } from '../theory/solo';
import { PathMode } from '../theory/triads';
import { FretDrillKind } from '../practice/fretDrills';

export type LessonGoal =
  /** play along (mic / MIDI / keyboard) and score at least `min` on one pass of this drill */
  | { kind: 'score'; lens: LensId; min: number }
  /** the melody coach reports every chord change landing, with at least `notes` notes written */
  | { kind: 'coach'; notes: number }
  /** answer this many ear-quiz rounds correctly in a row */
  | { kind: 'quiz'; streak: number }
  /** finish a ten-card fretboard sprint of this drill with at least this score */
  | { kind: 'fret'; drill: FretDrillKind; min: number }
  /** the crab canon scores at least `min`, with the two voices overlapping for a quarter of the loop */
  | { kind: 'crab'; min: number }
  /** nothing the app can measure — the player ticks it off */
  | { kind: 'check' };

export interface LessonSetup {
  view: 'jam' | 'write' | 'learn';
  genre?: string;
  mode?: ModeId;
  /** progression to put on the bench */
  prog?: { name: string; numerals: string[]; bars?: number[] };
  lens?: LensId;
  /** index into the genre's scale recommendations */
  scale?: number;
  /** open the transition panel on this card's arrow */
  xfer?: number;
  demo?: boolean;
  /** open the neck drills on this drill */
  drill?: FretDrillKind;
  /** how diagrams should talk: letters or numbers */
  labels?: 'names' | 'numbers';
  /** force an instrument (the fretboard lessons need strings) */
  instrument?: 'guitar' | 'bass';
  /** open the Triad Lab instead of the Solo Lab, set up like this */
  triads?: { mode?: PathMode; upper?: boolean; comp?: boolean };
}

export interface LessonStep {
  id: string;
  title: string;
  /** the idea, in two or three sentences */
  teach: string;
  /** the concrete thing to do */
  task: string;
  setup: LessonSetup;
  goal: LessonGoal;
}

export interface LearningPath {
  id: string;
  name: string;
  blurb: string;
  steps: LessonStep[];
}

const FOUR = { name: 'Four chords', numerals: ['I', 'vi', 'IV', 'V'] };
const BORROWED = { name: 'Borrowed rain', numerals: ['I', 'iv', 'V7', 'IV'] };
const BLUES = {
  name: 'Twelve-bar blues',
  numerals: ['I7', 'IV7', 'I7', 'I7', 'IV7', 'IV7', 'I7', 'I7', 'V7', 'IV7', 'I7', 'V7'],
};

export const PATHS: LearningPath[] = [
  {
    id: 'neck', name: 'Fretboard grammar',
    blurb: 'For players who know a lot of shapes and licks but not what is inside them. Numbers instead of fret positions — until finding a 3rd is as automatic as finding a barre chord.',
    steps: [
      {
        id: 'neck.numbers', title: 'Your grips, in numbers',
        teach: 'You already know these shapes. What you may not know is what each finger is holding. Every chord is a root, a 3rd and a 5th — the barre chord just repeats them across six strings. Once you can see R-5-R-3-5-R inside the grip, the grip becomes a map.',
        task: 'With labels on 123, click through the chords. For each one, find the ringed grip you already play and say its numbers out loud, low string to high. Notice which string carries the 3rd.',
        setup: { view: 'jam', instrument: 'guitar', genre: 'classic-rock', mode: 'major', prog: { name: 'Three grips', numerals: ['I', 'IV', 'V', 'IV'] }, labels: 'numbers', lens: 'arps' },
        goal: { kind: 'check' },
      },
      {
        id: 'neck.intervals', title: 'Intervals are shapes',
        teach: 'Because the strings are tuned in 4ths, every interval is a fixed move of the hand: a 5th is one string up and two frets along (your power chord), an octave is two strings up and two frets along, a major 3rd is one string up and one fret back. One exception — crossing onto the B string pushes everything a fret further.',
        task: 'Run the "Interval from a root" sprint. Read the rule after every miss; they repeat until they stick. 80 to pass.',
        setup: { view: 'jam', instrument: 'guitar', drill: 'interval', labels: 'numbers' },
        goal: { kind: 'fret', drill: 'interval', min: 80 },
      },
      {
        id: 'neck.degrees', title: 'See a dot, know its number',
        teach: 'Recall and recognition are different skills. Finding the 3rd is recall; glancing at a note in a lick you already play and knowing it is the ♭7 is recognition — that is the one that lets you understand your own vocabulary.',
        task: 'Run the "Name that degree" sprint. 80 to pass.',
        setup: { view: 'jam', instrument: 'guitar', drill: 'degree', labels: 'numbers' },
        goal: { kind: 'fret', drill: 'degree', min: 80 },
      },
      {
        id: 'neck.chordtones', title: 'A 3rd near your hand, always',
        teach: 'Playing the changes comes down to one question asked four times a bar: where is this chord\'s 3rd from where my hand is right now? Every five-fret box holds a root, a 3rd and a 5th of every chord.',
        task: 'Run the "Chord tone in position" sprint — click, or turn on Listen and play the answers on your guitar. 80 to pass.',
        setup: { view: 'jam', instrument: 'guitar', drill: 'chordtone', labels: 'numbers' },
        goal: { kind: 'fret', drill: 'chordtone', min: 80 },
      },
      {
        id: 'neck.caged', title: 'Five grips, one chord',
        teach: 'The same chord appears five times up the neck, each time as a grip you know from the open position: E, D, C, A, G shapes, in that order, overlapping end to end. The scale boxes you know are wrapped around those grips.',
        task: 'Stay on the first chord and walk the NECK positions from the home box upward. At each stop, read which shape you are in and find its root.',
        setup: { view: 'jam', instrument: 'guitar', genre: 'classic-rock', mode: 'major', prog: { name: 'One chord, five places', numerals: ['I', 'IV'], bars: [2, 2] }, labels: 'numbers', lens: 'arps' },
        goal: { kind: 'check' },
      },
      {
        id: 'neck.unison', title: 'Same note, next string',
        teach: 'Every note lives in up to five places. Moving a lick to another position is just moving each note five frets along and one string down — four when you cross G–B. This is how a phrase you know in one box becomes a phrase you know everywhere.',
        task: 'Run the "Same note, next string" sprint. 85 to pass.',
        setup: { view: 'jam', instrument: 'guitar', drill: 'unison' },
        goal: { kind: 'fret', drill: 'unison', min: 85 },
      },
      {
        id: 'neck.names', title: 'Roots have names',
        teach: 'Numbers carry the meaning, but a chord chart says "F♯m" — so the root needs a name. You likely know the low E and A strings from barre chords; the other strings are the same notes, found by octave shapes.',
        task: 'Run the "Note names" sprint. 80 to pass.',
        setup: { view: 'jam', instrument: 'guitar', drill: 'note', labels: 'names' },
        goal: { kind: 'fret', drill: 'note', min: 80 },
      },
      {
        id: 'neck.licks', title: 'Your licks, in numbers',
        teach: 'A lick is not a set of frets — it is a set of numbers against a chord. "♭7 5 4 ♭3 R" over A7 is the same lick over D7 five frets up. Once a lick you already own is written as numbers, it works over every chord in every key, and you finally know why it worked in the first place.',
        task: 'In the melody workbench, paste the tab of a lick you know (or arm Step entry and click it in on the fretboard). Read the numbers under the tab. Select its bar and press "Same numbers → next bar", then save it to the Lick shelf and drop it onto the V chord.',
        setup: { view: 'write', instrument: 'guitar', genre: 'blues', mode: 'major', prog: { name: 'Four bars of blues', numerals: ['I7', 'IV7', 'I7', 'V7'] }, labels: 'numbers' },
        goal: { kind: 'check' },
      },
    ],
  },
  {
    id: 'four', name: 'Solo over four chords',
    blurb: 'From one note per chord to a free solo that spells the harmony. Seven rungs, each one a graded play-along.',
    steps: [
      {
        id: 'four.roots', title: 'Find every root',
        teach: 'Before a solo can follow the chords, you have to know where the chords are. The root is each chord\'s home address.',
        task: 'Turn on Listen, press play, and hit the root of each chord as it arrives. One note per chord is enough.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'roots' },
        goal: { kind: 'score', lens: 'roots', min: 80 },
      },
      {
        id: 'four.rhythm', title: 'One note, all rhythm',
        teach: 'Half of every great solo is rhythm. With a single pitch there is nothing left to play with except WHEN: early, late, repeated, or not at all.',
        task: 'Play only the lit note for the whole loop. Make every bar a different rhythm, and leave at least one bar nearly empty.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'rhythm', demo: true },
        goal: { kind: 'score', lens: 'rhythm', min: 90 },
      },
      {
        id: 'four.thirds', title: 'Land on the 3rd',
        teach: 'The 3rd is the note that tells the ear which chord just arrived — major or minor, this chord and no other. Land on it and the solo starts to sound like it knows the song.',
        task: 'Anything you like during the bar, but beat 1 of each chord is its ringed 3rd.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'thirds' },
        goal: { kind: 'score', lens: 'thirds', min: 70 },
      },
      {
        id: 'four.arps', title: 'Chord tones only',
        teach: 'Arpeggio soloing feels like a cage for a minute. Then you notice that you could switch the backing off and still hear the chords — the line is carrying the harmony by itself.',
        task: 'Only the lit notes of each chord. Stay inside for a whole pass.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'arps' },
        goal: { kind: 'score', lens: 'arps', min: 75 },
      },
      {
        id: 'four.guide', title: 'Guide tones',
        teach: 'Two notes per chord, held long, moving to the nearest one at each change. It is the thinnest line that still carries the whole progression — and the skeleton of most written melodies.',
        task: 'Hold one lit note per chord. When the chord changes, move to the closest lit note — often a single step.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'guide' },
        goal: { kind: 'score', lens: 'guide', min: 70 },
      },
      {
        id: 'four.three', title: 'Three-note answer',
        teach: 'Limits make phrases. The demo plays a call in one bar and goes silent in the next: that silence is yours. Steal its rhythm, change its ending.',
        task: 'Answer every call using only the three lit notes.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'three', demo: true },
        goal: { kind: 'score', lens: 'three', min: 85 },
      },
      {
        id: 'four.free', title: 'The whole map',
        teach: 'Everything back on. The rules are the ones you have been practising: land on the bright notes, travel through the rest, and leave air between phrases.',
        task: 'A free pass that still lands most chord changes on a chord tone.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: FOUR, lens: 'map' },
        goal: { kind: 'score', lens: 'map', min: 70 },
      },
    ],
  },
  {
    id: 'borrow', name: 'Hear the borrowed chords',
    blurb: 'Why one out-of-key chord can change the weather — heard, explained, played over, then recognised by ear.',
    steps: [
      {
        id: 'borrow.move', title: 'One note changes the weather',
        teach: 'The minor iv in a major key is borrowed from the parallel minor. Only one note differs from the plain IV — the ♭6 — and it falls a half step into the tonic\'s 5th. That sigh is the entire effect.',
        task: 'Press "Hear the move" and listen for the falling half step. Then sing or play just those two notes.',
        setup: { view: 'write', genre: 'classic-rock', mode: 'major', prog: { name: 'The sigh', numerals: ['I', 'IV', 'iv', 'I'] }, xfer: 2 },
        goal: { kind: 'check' },
      },
      {
        id: 'borrow.ab', title: 'Before and after',
        teach: 'A spice is easiest to hear against what it replaced. A/B plays the old loop and the new one back to back in the same groove, so the only thing that changes is the harmony.',
        task: 'Click the 🌧 chip on the IV card to borrow the iv, then press 🔀 A/B and listen for the moment the colour turns.',
        setup: { view: 'write', genre: 'classic-rock', mode: 'major', prog: { name: 'Plain first', numerals: ['I', 'IV', 'V', 'IV'] } },
        goal: { kind: 'check' },
      },
      {
        id: 'borrow.solo', title: 'Follow it with your hands',
        teach: 'Over the borrowed chord your scale is wrong by exactly one note. The map shows the trade: the purple spice note comes in, the dashed rub note stands down — for one bar.',
        task: 'Land on the 3rd of every chord. Over the iv that means the spice note.',
        setup: { view: 'jam', genre: 'classic-rock', mode: 'major', prog: BORROWED, lens: 'thirds', scale: 1 },
        goal: { kind: 'score', lens: 'thirds', min: 70 },
      },
      {
        id: 'borrow.quiz', title: 'Which chord changed?',
        teach: 'Now without the labels. You will hear a loop twice; the second time one chord has been spiced. Point at the chord that changed.',
        task: 'Get three in a row in the ear quiz below.',
        setup: { view: 'learn' },
        goal: { kind: 'quiz', streak: 3 },
      },
    ],
  },
  {
    id: 'write', name: 'Write an eight-bar melody',
    blurb: 'One motif, developed: sequence it, answer it, change its ending, give it a second section, and get it out to the OP-1.',
    steps: [
      {
        id: 'write.seed', title: 'Start with one good bar',
        teach: 'Melodies are built from a small idea repeated and varied, not from eight bars of new notes. So the first job is to find one bar you like.',
        task: 'Seed the roll from the demo lick (or click in your own notes), then clear every bar except your favourite. Lock the notes you never want to lose.',
        setup: { view: 'write', genre: 'pop', mode: 'major', prog: { name: 'Eight bars', numerals: ['I', 'vi', 'IV', 'V', 'I', 'vi', 'ii', 'V'] } },
        goal: { kind: 'check' },
      },
      {
        id: 'write.sequence', title: 'Say it again, higher or lower',
        teach: 'A sequence repeats the motif\'s shape starting from a different note, so it follows the new chord. The ear hears "the same thing, moved" — that recognition is what makes a tune catchy.',
        task: 'Select your bar and Sequence it into the next bar, and the next. Notice how the first note of each copy lands on that chord\'s 3rd.',
        setup: { view: 'write' },
        goal: { kind: 'check' },
      },
      {
        id: 'write.answer', title: 'Question and answer',
        teach: 'A phrase that ends up in the air is a question. An answer keeps the rhythm, turns the contour over, and comes to rest on a root. Two bars of question, two of answer: that is most of popular melody.',
        task: 'Use Answer to reply to your motif in bar 4 (and bar 8). Listen to how the root at the end closes the thought.',
        setup: { view: 'write' },
        goal: { kind: 'check' },
      },
      {
        id: 'write.land', title: 'Make every change land',
        teach: 'The coach reads your melody against the chords. When a chord arrives on a note that fights it, the fix is usually one step away.',
        task: 'Work the coach\'s notes (Fix clashes helps) until every chord change lands on a chord tone.',
        setup: { view: 'write' },
        goal: { kind: 'coach', notes: 12 },
      },
      {
        id: 'write.section', title: 'A second section',
        teach: 'A loop becomes a song when something contrasts with it. Copy section A, then change one big thing — start on a different chord, or lift the melody\'s peak a third higher.',
        task: 'Add section B as a copy, vary it, set the song order to A A B A and press Play song.',
        setup: { view: 'write' },
        goal: { kind: 'check' },
      },
      {
        id: 'write.tape', title: 'Get it onto tape',
        teach: 'The OP-1 field records audio, not MIDI, to its tape — so play it in. Export the MIDI for your DAW if you want the notes, and use the key chart to learn the line on the OP-1\'s own keys.',
        task: 'Switch to OP-1 FIELD, slow the loop with the tempo ramp, learn the melody from the lit keys, then arm a tape track and record it over the chords.',
        setup: { view: 'jam' },
        goal: { kind: 'check' },
      },
    ],
  },
  {
    id: 'blues', name: 'Play the twelve-bar blues',
    blurb: 'Dominant chords that never resolve, one famous half-step, and the rub that gives the style its name.',
    steps: [
      {
        id: 'blues.roots', title: 'Know the form',
        teach: 'Twelve bars, three chords, and a shape you will hear for the rest of your life: four bars of home, two away, two home, then the turnaround.',
        task: 'Play the root of every bar\'s chord, all twelve bars, without getting lost.',
        setup: { view: 'jam', genre: 'blues', mode: 'major', prog: BLUES, lens: 'roots' },
        goal: { kind: 'score', lens: 'roots', min: 80 },
      },
      {
        id: 'blues.rub', title: 'The rub is the blues',
        teach: 'The blues scale has a minor 3rd; the I7 chord has a major one. They are a half step apart and they rub — and that rub is the sound. Guitarists bend it, keyboard players crush the two keys together.',
        task: 'Over the I7, slide or bend from the dashed rub note up into the purple chord tone next to it. Do it until it sounds like a sneer.',
        setup: { view: 'jam', genre: 'blues', mode: 'major', prog: BLUES, lens: 'map' },
        goal: { kind: 'check' },
      },
      {
        id: 'blues.thirds', title: 'The famous half step',
        teach: 'When I7 moves to IV7, the 3rd of the first chord drops one fret and becomes the ♭7 of the second. That single half step outlines the most important change in the form.',
        task: 'Land on the 3rd of each chord — and listen for that one-fret drop going into bar 5.',
        setup: { view: 'jam', genre: 'blues', mode: 'major', prog: BLUES, lens: 'thirds', xfer: 3 },
        goal: { kind: 'score', lens: 'thirds', min: 65 },
      },
      {
        id: 'blues.three', title: 'Call and response',
        teach: 'The blues is a conversation: a line, then its answer. It works with three notes — it has worked with three notes for a hundred years.',
        task: 'Answer every call with only the three lit notes.',
        setup: { view: 'jam', genre: 'blues', mode: 'major', prog: BLUES, lens: 'three', demo: true },
        goal: { kind: 'score', lens: 'three', min: 85 },
      },
    ],
  },
  {
    id: 'triads', name: 'Triads on three strings',
    blurb: 'Three notes, three strings, every chord a fret or two from the last — the comping and soloing skeleton hiding inside every progression.',
    steps: [
      {
        id: 'triads.shapes', title: 'Three shapes, one chord',
        teach: 'A triad has three notes, so it has three close shapes: root on the bottom, 3rd on the bottom, 5th on the bottom. On one set of three strings they climb the neck like rungs — learn the three shapes and you own that chord everywhere.',
        task: 'In the neck view, click each shape of the first chord from low to high and play it. Say which note is on top: root, 3rd, or 5th.',
        setup: { view: 'jam', genre: 'classic-rock', mode: 'major', prog: { name: 'Three chords', numerals: ['I', 'IV', 'V', 'IV'] }, triads: { mode: 'close' } },
        goal: { kind: 'check' },
      },
      {
        id: 'triads.close', title: 'Barely move',
        teach: 'Root position everywhere means leaping around the neck. Pick the right inversion and the next chord is one or two frets away — often with a note that does not move at all. The lab counts the frets for both so you can see the difference.',
        task: 'Compare "Root position" with "Stay close" and read the fret count. Then play the close path around the loop, watching which voice holds at each change.',
        setup: { view: 'jam', genre: 'classic-rock', mode: 'major', prog: { name: 'Three chords', numerals: ['I', 'IV', 'V', 'IV'] }, triads: { mode: 'close' } },
        goal: { kind: 'check' },
      },
      {
        id: 'triads.comp', title: 'Be the rhythm guitarist',
        teach: 'Small triads high on the neck are what funk, soul and reggae rhythm parts are made of: they cut through without mud, and they leave the bass player room.',
        task: 'Turn on Listen and play the path along with the band — arpeggiate the shapes one note at a time so every note can be heard and graded.',
        setup: { view: 'jam', genre: 'funk', prog: { name: 'Pocket', numerals: ['I', 'bVII', 'IV', 'I'] }, mode: 'mixolydian', triads: { mode: 'close', comp: true }, lens: 'arps' },
        goal: { kind: 'score', lens: 'arps', min: 75 },
      },
      {
        id: 'triads.climb', title: 'Make the top voice a melody',
        teach: 'The highest note of each shape is what the ear follows. Choose inversions so that top note climbs — or falls — and your chord part has become a melody. Pin any shape you like and the path re-routes around it.',
        task: 'Try Climb, then Descend. Then pin one shape by clicking it and watch the neighbours change to stay close to your choice.',
        setup: { view: 'jam', genre: 'pop', mode: 'major', prog: { name: 'Four chords', numerals: ['I', 'vi', 'IV', 'V'] }, triads: { mode: 'climb' } },
        goal: { kind: 'check' },
      },
      {
        id: 'triads.upper', title: 'The triad inside the seventh chord',
        teach: 'The top three notes of any seventh chord are a plain triad of their own: over Am7 that is a C major triad; over Dm7, F major. Play the simple triad, let the bass hold the root, and you get the rich chord for the price of the easy one.',
        task: 'Switch on "3-5-7" and read the names that appear on each card. Play those triads over the loop and hear the sevenths without ever fretting a seventh chord.',
        setup: { view: 'jam', genre: 'neo-soul', prog: { name: 'Seventh heaven', numerals: ['ii7', 'V7', 'Imaj7', 'vi7'] }, mode: 'major', triads: { mode: 'close', upper: true, comp: true } },
        goal: { kind: 'check' },
      },
    ],
  },
  {
    id: 'crab', name: 'Meet the crab',
    blurb: 'Bach\'s trick from 1747: one line of music that accompanies itself when a second player reads it from the end. Three steps from "what?" to a canon that scores.',
    steps: [
      {
        id: 'crab.hear', title: 'A line that walks backwards',
        teach: 'The crab canon is a single melody played forwards and, at the same time, from the end — crabs walk sideways, the line walks backwards. For it to work, every note has to do two jobs: fit its own chord, and fit the chord its mirror image lands on. Most melodies fail the second job spectacularly, which is the fun part.',
        task: 'Seed a melody in the workbench (🌱), press 🦀 Let the crab in, and play. Watch the crab walk the Möbius strip the other way, then read the verdict: it names every place the backwards voice steps on something.',
        setup: { view: 'write', genre: 'pop', mode: 'major', prog: { name: 'Four chords', numerals: ['I', 'vi', 'IV', 'V'] } },
        goal: { kind: 'check' },
      },
      {
        id: 'crab.mirror', title: 'Harmony that reads both ways',
        teach: 'Read backwards, bar 1 lands over bar 4\'s chord — unless the progression is a palindrome. I–vi–IV–vi–I meets itself in the middle, so any note that fit going forward fits going back, by construction. Bach\'s crab canon leans on almost exactly this: its harmony is nearly symmetrical.',
        task: 'Press 🪞 Mirror the chords. The section doubles, reading the same from either end. Play it — your line, then the crab answering it. Then write into the second half so the two voices overlap.',
        setup: { view: 'write' },
        goal: { kind: 'check' },
      },
      {
        id: 'crab.proof', title: 'Agree with yourself',
        teach: 'Where the voices overlap they can grind: a half step, a tritone, a 7th on a strong beat. 🩹 Make it crab-proof moves each unlocked note to the nearest pitch that works over both chords and against the other voice — the fix a canon writer makes by hand, one note at a time. Lock any note you refuse to give up and the solver works around it.',
        task: 'Work the verdict\'s notes and crab-proof the line until the crab scores 85 with the voices overlapping for at least a quarter of the loop.',
        setup: { view: 'write' },
        goal: { kind: 'crab', min: 85 },
      },
    ],
  },
];

export const ALL_STEPS: LessonStep[] = PATHS.flatMap((p) => p.steps);
