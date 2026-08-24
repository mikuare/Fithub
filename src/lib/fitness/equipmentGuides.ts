import type { Equipment, GoalKind } from '@/types';
import { EXERCISES, IMPLIED_EQUIPMENT, expandEquipment } from '@/data/exercises';

/* ============================================================
   Equipment guides
   Kit-level how-to, one entry per selectable piece of equipment:
   what it is, the order you actually do things in, how long a
   session with it should take, and where it goes wrong.

   Deliberately separate from the exercise library — the library
   answers "how do I do this movement", this answers "I own this
   thing, what do I do with it".
   ============================================================ */

export interface EquipmentPlanRow {
  label: string;
  detail: string;
  /** Recommended minutes for this part of a session with the kit. */
  minutes: number;
}

export interface EquipmentGuide {
  equipment: Equipment;
  /** One line on what the thing actually is. */
  summary: string;
  /** What it trains, in plain words. */
  trains: string[];
  /** How to use it, in order. */
  steps: string[];
  /** A session broken into parts, each with recommended minutes. */
  plan: EquipmentPlanRow[];
  /** Sets, reps or pace for the working part of the session. */
  dose: string;
  /** How often per week. */
  frequency: string;
  safety: string[];
  /**
   * Search terms for a video reference, or null where no video would help —
   * "how to use a mat" is not a thing anyone needs to watch. The UI says so
   * plainly rather than sending people to a dead search.
   */
  videoQuery: string | null;
}

const GUIDES: EquipmentGuide[] = [
  {
    equipment: 'ankle_strap',
    summary:
      'A padded cuff that buckles round your ankle with a D-ring on the outside, so a low cable or an anchored band can pull on your leg. It turns any pulley or door anchor into direct glute and hip work.',
    trains: ['Glutes', 'Hip abductors', 'Hamstrings', 'Hip flexors'],
    steps: [
      'Set the cable pulley — or your band anchor — at the lowest position, near the floor.',
      'Wrap the cuff round the working ankle with the padded side against your skin, sitting just above the ankle bone, not on it.',
      'Buckle it snug: one finger should just slide underneath. A loose cuff slides and rubs a raw patch within a set.',
      'Clip the carabiner to the D-ring, then step away until there is tension on the cable with your working leg still under your hip.',
      'Hold something solid with one hand, stand tall, brace your middle and keep the standing knee soft.',
      'Drive the leg back for a kickback, out to the side for abduction, or across your body for adduction — the movement comes from the hip, never from arching your lower back.',
      'Pause for a beat at the end of the range where the muscle is working hardest.',
      'Return slowly against the resistance over about three seconds. Never let the stack drop and clang.',
      'Finish every rep on that leg, then swap the cuff to the other ankle and repeat.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Fit the cuff, set the pulley low, one light feeler set per leg', minutes: 3 },
      { label: 'Working sets', detail: '3 sets × 12–15 reps per leg, 45–60 s rest', minutes: 12 },
      { label: 'Stretch down', detail: 'Hip flexor and glute stretch, 30 s each side', minutes: 3 },
    ],
    dose: '3 sets × 12–15 reps per leg, 45–60 seconds rest. Go light — these are small muscles and the strap punishes momentum.',
    frequency: '2–3 sessions a week, on lower-body or glute days.',
    safety: [
      'Keep the cuff above the ankle bone. Sitting it directly on the bone bruises fast.',
      'Sharp pinching at the front of the hip means the range is too long — shorten it and drop the weight.',
      'Never arch your lower back to squeeze out extra range; stop the rep where your hip stops.',
    ],
    videoQuery: 'ankle strap cable kickback proper form',
  },
  {
    equipment: 'power_twister',
    summary:
      'A spring-loaded steel bar you bend with both arms. Every rep is a hard squeeze through the chest, shoulders and forearms, and it needs about a metre of space and no floor at all.',
    trains: ['Chest', 'Front deltoids', 'Forearms', 'Grip', 'Biceps'],
    steps: [
      'Inspect the bar before every session: the spring must be fully covered and both handles firmly seated. Do not use one that is cracked, rusted or bent.',
      'Grip both handles with a full wrap and your thumbs round the bar — never a thumbless grip on a spring.',
      'Hold the bar horizontally across the front of your chest, arms almost straight, elbows soft.',
      'Brace your middle, pull your shoulder blades down and back, and breathe in.',
      'Bend the bar by squeezing your hands toward each other. The work comes from your chest and shoulders; your elbows barely change angle.',
      'Hold the deepest bend for one to two seconds, still breathing.',
      'Let it straighten back over about three seconds under full control. Never let it snap.',
      'For the arm version, hold the bar vertically in front of your chest and bend it the same way — this shifts the work to biceps and forearms.',
      'End the set while you can still control the return, not when the bar wins.',
    ],
    plan: [
      { label: 'Inspect and warm up', detail: 'Check the spring and handles, arm circles, empty-hand squeezes', minutes: 3 },
      { label: 'Working sets', detail: '3–4 sets × 8–12 slow reps, 60 s rest', minutes: 10 },
      { label: 'Stretch down', detail: 'Chest doorway stretch and wrist flexor stretch', minutes: 2 },
    ],
    dose: '3–4 sets × 8–12 reps with a two-second squeeze and a three-second return, 60 seconds rest. Start with the lightest bar you own.',
    frequency: '2–3 non-consecutive days a week — the springs are demanding on elbows and wrists.',
    safety: [
      'Never let the bar snap straight. An uncontrolled return is how people hurt an elbow with this.',
      'Keep your face and eyes out of the bar path, and clear the space around you.',
      'Check where the spring meets each handle before every session; retire the bar at the first sign of a crack.',
      'Elbow or wrist pain means stop for the day and come back with a lighter bar.',
    ],
    videoQuery: 'power twister bar exercises proper form',
  },
  {
    equipment: 'bodyweight',
    summary:
      'You, the floor and gravity. Always available, always the fallback — every FitHub programme can be run on this alone.',
    trains: ['Everything, with the right movement choice'],
    steps: [
      'Clear a space roughly the size of a bath towel and check the floor is not slippery.',
      'Warm up by moving the joints you are about to load: hips, shoulders, ankles.',
      'Pick a push, a pull, a squat and a hinge to cover the whole body.',
      'Make an exercise harder by slowing it down or raising your feet, not by adding sloppy reps.',
      'Stop each set two or three reps before failure so your form stays honest.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Joint circles and two easy sets', minutes: 5 },
      { label: 'Working sets', detail: '3–4 rounds of a push, pull, squat and hinge', minutes: 20 },
      { label: 'Cool down', detail: 'Easy walking and stretching', minutes: 5 },
    ],
    dose: '3–4 sets × 8–20 reps depending on the movement, 45–90 seconds rest.',
    frequency: 'Any day you have not got equipment — up to 5 or 6 days a week if you vary the movements.',
    safety: [
      'Hands and feet need grip: bare feet or trainers, not socks on a smooth floor.',
      'Progress by making a movement harder, never by rushing the reps.',
    ],
    videoQuery: null,
  },
  {
    equipment: 'mat',
    summary: 'A padded surface that keeps your spine, knees and elbows off a hard floor. Nothing to learn — just use it and keep it clean.',
    trains: ['Comfort and grip for floor work'],
    steps: [
      'Roll it out on a flat, dry floor with nothing underneath it.',
      'Put the grippier side down; the softer side goes against your skin.',
      'Centre yourself on it so a knee or elbow cannot land on bare floor mid-set.',
      'Wipe it down after a sweaty session and hang or roll it loosely — folding creases it permanently.',
    ],
    plan: [
      { label: 'Set up', detail: 'Roll out, check the surface is dry', minutes: 1 },
      { label: 'Floor work', detail: 'Core, mobility or stretching', minutes: 15 },
      { label: 'Pack down', detail: 'Wipe and roll', minutes: 2 },
    ],
    dose: 'However long the floor work takes — the mat is not the exercise.',
    frequency: 'Every session that puts a knee, hip or spine on the floor.',
    safety: [
      'A mat sliding on a polished floor is worse than no mat. If it slides, use a rug underneath or a different surface.',
    ],
    videoQuery: null,
  },
  {
    equipment: 'dumbbells',
    summary: 'A pair of handheld weights — the most flexible strength tool there is. Each arm works on its own, so weak sides cannot hide.',
    trains: ['Whole body', 'Balance between sides'],
    steps: [
      'Pick a weight you can control for the whole set, not just the first rep.',
      'Lift them off the floor with a flat back and bent knees, exactly like a small deadlift.',
      'Set your position first — feet planted, ribs down, shoulder blades set — before the first rep.',
      'Move through the full range you own, and keep both sides doing the same work.',
      'Lower under control; the lowering half is where most of the muscle is built.',
      'Put them down deliberately at the end of the set rather than dropping them.',
    ],
    plan: [
      { label: 'Warm up', detail: 'One or two light feeler sets of the first movement', minutes: 5 },
      { label: 'Working sets', detail: '3–4 sets per exercise, 2–4 exercises', minutes: 25 },
      { label: 'Cool down', detail: 'Stretch what you trained', minutes: 5 },
    ],
    dose: '3–4 sets × 8–12 reps for size, 4–6 reps heavier for strength. 60–120 seconds rest.',
    frequency: '2–4 sessions a week per muscle group.',
    safety: [
      'Clear your feet before the last rep of any overhead or pressing set.',
      'If one side fails first, the set is over — do not grind out extra reps on the strong side.',
    ],
    videoQuery: 'dumbbell training for beginners proper form',
  },
  {
    equipment: 'barbell',
    summary: 'A long loaded bar for the heaviest lifts you will do. Rewards precise setup and punishes casual technique.',
    trains: ['Whole body', 'Maximum strength'],
    steps: [
      'Load both sides evenly and use collars every single time.',
      'Set your grip width and check the bar sits in the same place on both hands.',
      'Take your brace before the bar moves: breathe into your belly and lock your ribs down.',
      'Move the bar in a straight line over your mid-foot.',
      'Finish each rep in a controlled, stacked position rather than throwing the weight.',
      'Rack or set the bar down under control — most barbell injuries happen after the last rep.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Empty bar, then two or three ramping sets', minutes: 10 },
      { label: 'Working sets', detail: '3–5 heavy sets of the main lift', minutes: 20 },
      { label: 'Accessory and cool down', detail: 'Lighter work and stretching', minutes: 10 },
    ],
    dose: '3–5 sets × 3–8 reps for strength, 2–4 minutes rest between heavy sets.',
    frequency: '2–4 sessions a week, rotating the main lifts.',
    safety: [
      'Collars on, every set, even the light ones.',
      'Use safety pins or a spotter for anything you are not certain you can finish.',
    ],
    videoQuery: 'barbell lifting technique for beginners',
  },
  {
    equipment: 'bench',
    summary: 'A stable padded platform for pressing, rowing and supported work — flat or set to an incline.',
    trains: ['Chest', 'Shoulders', 'Back', 'Arms'],
    steps: [
      'Check the bench is locked at the angle you want and does not rock.',
      'Lie or sit with five points of contact: both feet, hips, upper back and head.',
      'Pull your shoulder blades down and together and keep them there for the whole set.',
      'Keep your feet flat and quiet — bouncing your hips off the bench is a wasted rep.',
      'Sit up slowly after the last rep, especially after heavy pressing.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Set the angle, two light sets', minutes: 5 },
      { label: 'Working sets', detail: '3–4 sets of a press or a row', minutes: 20 },
      { label: 'Cool down', detail: 'Chest and shoulder stretch', minutes: 5 },
    ],
    dose: '3–4 sets × 6–12 reps, 90 seconds rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Never press heavy over your face without a spotter or safety pins.',
      'An incline above about 45° loads the shoulder far more than the chest.',
    ],
    videoQuery: 'how to set up on a weight bench correctly',
  },
  {
    equipment: 'squat_rack',
    summary: 'An upright frame that holds a barbell at the height you need and catches it if a rep fails.',
    trains: ['Legs', 'Whole body strength'],
    steps: [
      'Set the J-hooks so the bar sits at roughly mid-chest height — you should have to dip slightly to get under it.',
      'Set the safety pins just below the lowest point of your lift. This is the whole reason the rack exists.',
      'Walk the bar out in two or three deliberate steps, no more.',
      'Do the set with the pins in reach, not halfway across the gym.',
      'Walk it back in and feel both hooks catch before you let go.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Set hooks and pins, empty bar, ramping sets', minutes: 10 },
      { label: 'Working sets', detail: '3–5 sets of squats or presses', minutes: 20 },
      { label: 'Cool down', detail: 'Hip and ankle stretching', minutes: 5 },
    ],
    dose: '3–5 sets × 3–8 reps, 2–3 minutes rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Pins set correctly turn a failed squat into a non-event. Set them every time.',
      'Check both J-hooks are seated before you unrack.',
    ],
    videoQuery: 'how to set up a squat rack safety pins',
  },
  {
    equipment: 'cable',
    summary: 'A weight stack on a pulley. Tension stays constant through the whole range, which free weights cannot do.',
    trains: ['Whole body', 'Controlled isolation work'],
    steps: [
      'Set the pulley height for the movement: low for curls and kickbacks, high for pushdowns and pulldowns.',
      'Pick the handle or attachment, and clip it on properly — check the carabiner has closed.',
      'Set the pin in the stack and give it a small tug to confirm it caught.',
      'Step away until the stack lifts slightly, so there is tension before your first rep.',
      'Move only the joint the exercise names; the rest of you stays still.',
      'Control the return all the way — never let the stack slam.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Set height and pin, one light set', minutes: 4 },
      { label: 'Working sets', detail: '3–4 sets × 10–15 reps', minutes: 18 },
      { label: 'Cool down', detail: 'Stretch what you trained', minutes: 3 },
    ],
    dose: '3–4 sets × 10–15 reps, 45–75 seconds rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'A slamming stack means the weight is too heavy for the way you are lifting it.',
      'Keep fingers clear of the pulley and the stack itself.',
    ],
    videoQuery: 'cable machine exercises proper form',
  },
  {
    equipment: 'smith',
    summary: 'A barbell fixed to vertical rails with hooks all the way up. The bar path is chosen for you, which helps and limits in equal measure.',
    trains: ['Legs', 'Chest', 'Shoulders'],
    steps: [
      'Set the safety stops at the depth you plan to reach.',
      'Rotate the bar to unhook, and check it has cleared before you take the load.',
      'Position your feet slightly forward of the bar for squats, since the path is fixed and yours is not.',
      'Do the set, keeping the same speed on the way down as on the way up.',
      'Re-hook by rotating the bar and feeling it catch before you release.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Set stops, two light sets', minutes: 6 },
      { label: 'Working sets', detail: '3–4 sets × 8–12 reps', minutes: 20 },
      { label: 'Cool down', detail: 'Stretching', minutes: 4 },
    ],
    dose: '3–4 sets × 8–12 reps, 90 seconds rest.',
    frequency: '1–3 sessions a week.',
    safety: [
      'Always confirm the bar has unhooked before you take the weight.',
      'The fixed path means your joints must fit the machine; if a lift feels wrong here, do it with free weights instead.',
    ],
    videoQuery: 'smith machine how to use safely',
  },
  {
    equipment: 'machine',
    summary: 'A pin-loaded station that guides one movement. Easy to learn, easy to load, and the safest place to train close to failure alone.',
    trains: ['Whichever muscle the station is built for'],
    steps: [
      'Read the diagram on the machine — most have one, and most people skip it.',
      'Adjust the seat so the working joint lines up with the machine pivot.',
      'Set the pin, then do one light rep to check the range feels natural.',
      'Sit back into the pads and hold the handles without white-knuckling them.',
      'Move through the full range at a steady pace, no rocking or bouncing.',
      'Let the stack come to rest between reps only if the exercise calls for it.',
    ],
    plan: [
      { label: 'Adjust and warm up', detail: 'Set seat and pin, one light set', minutes: 4 },
      { label: 'Working sets', detail: '3–4 sets × 10–15 reps', minutes: 18 },
      { label: 'Cool down', detail: 'Stretch what you trained', minutes: 3 },
    ],
    dose: '3–4 sets × 10–15 reps, 60–90 seconds rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Seat height matters more than weight — a misaligned pivot loads the joint, not the muscle.',
      'Keep fingers away from the stack and moving arms.',
    ],
    videoQuery: 'gym machine setup seat adjustment guide',
  },
  {
    equipment: 'kettlebell',
    summary: 'A cast weight with an offset handle. The load hangs behind your grip, which makes swings, cleans and carries feel completely unlike a dumbbell.',
    trains: ['Hips', 'Glutes', 'Back', 'Grip', 'Conditioning'],
    steps: [
      'Start with the bell a forearm-length in front of your feet.',
      'Hinge at the hips with a flat back and tip the bell toward you to start the swing.',
      'Hike it back between your legs like a rugby pass, keeping your forearms against your inner thighs.',
      'Snap your hips forward to stand tall. The arms are ropes — they do not lift the bell.',
      'Let it float to chest height, then guide it straight back into the next hinge.',
      'Park it on the floor at the end of the set instead of dropping it from the top.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Hip hinges and a light set of swings', minutes: 5 },
      { label: 'Working sets', detail: '5–8 sets × 10–15 swings, or a carry circuit', minutes: 15 },
      { label: 'Cool down', detail: 'Hamstring and hip stretching', minutes: 5 },
    ],
    dose: '5–8 sets × 10–15 swings on the minute, or 3 sets × 8 per side for presses and cleans.',
    frequency: '2–3 sessions a week.',
    safety: [
      'A swing is a hip snap, never a front raise with the arms.',
      'Round backs and kettlebells do not mix — stop the set when your back stops staying flat.',
    ],
    videoQuery: 'kettlebell swing proper form beginner',
  },
  {
    equipment: 'bands',
    summary: 'Elastic resistance that gets harder as it stretches. Packs into a bag, anchors to a door, and is the easiest way to train away from a gym.',
    trains: ['Whole body', 'Shoulder health', 'Warm-ups'],
    steps: [
      'Check the whole band for nicks or thin spots before every session. A band fails suddenly, not gradually.',
      'Anchor it to something that genuinely will not move — a proper door anchor, not a handle.',
      'Set your distance from the anchor so there is light tension before the first rep.',
      'Pull or press to the end of your range and pause where the band is tightest.',
      'Return slowly and under control; letting it snap back wastes the best part of the rep.',
      'Store it out of sunlight and away from heat, which is what kills the rubber.',
    ],
    plan: [
      { label: 'Check and warm up', detail: 'Inspect the band, pull-aparts and light sets', minutes: 4 },
      { label: 'Working sets', detail: '3–4 sets × 12–20 reps', minutes: 16 },
      { label: 'Cool down', detail: 'Stretching', minutes: 3 },
    ],
    dose: '3–4 sets × 12–20 reps, 45–60 seconds rest.',
    frequency: '2–4 sessions a week, and freely as a warm-up.',
    safety: [
      'Never stretch a band toward your face, and never stand where a snapped band would hit you.',
      'Replace any band with a visible nick — no exceptions.',
    ],
    videoQuery: 'resistance band exercises full body proper form',
  },
  {
    equipment: 'pullup_bar',
    summary: 'A fixed horizontal bar you hang from. The single best upper-body pulling tool, and it needs no weights at all.',
    trains: ['Lats', 'Upper back', 'Biceps', 'Grip', 'Core'],
    steps: [
      'If it is a doorway bar, check the fixing and give it a firm downward tug before you hang.',
      'Grip slightly wider than your shoulders with thumbs wrapped round the bar.',
      'Hang with your shoulders pulled down away from your ears — never a dead, loose hang at the start.',
      'Pull your elbows down toward your ribs and lead with your chest, not your chin.',
      'Clear the bar with your collarbone, pause for a beat, then lower all the way under control.',
      'Step or drop off the bar with soft knees when the set is done.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Dead hangs and band pull-aparts', minutes: 5 },
      { label: 'Working sets', detail: '4–6 sets to two reps short of failure', minutes: 15 },
      { label: 'Cool down', detail: 'Lat and forearm stretching', minutes: 4 },
    ],
    dose: '4–6 sets of as many clean reps as you have minus two, 2 minutes rest. Use a band or your feet if you cannot yet do one.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Test a doorway bar every session — they work loose.',
      'Keep the space under the bar clear, and never kip until strict reps are easy.',
    ],
    videoQuery: 'pull up proper form beginner progression',
  },
  {
    equipment: 'dip_bars',
    summary: 'Two parallel bars at hip or chest height for dips, leg raises and support holds. Brutally effective for chest, triceps and core.',
    trains: ['Chest', 'Triceps', 'Front deltoids', 'Core'],
    steps: [
      'Check the bars are stable and spaced roughly shoulder-width — much wider punishes the shoulder.',
      'Jump or step to a locked-out support hold, shoulders pressed down, chest up.',
      'Hold that top position still for a moment before the first rep.',
      'Lower under control until your upper arms are roughly parallel to the floor, leaning slightly forward for chest, upright for triceps.',
      'Press back to the top without shrugging your shoulders up round your ears.',
      'Lower yourself off the bars rather than dropping when the set is over.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Support holds and band pushdowns', minutes: 5 },
      { label: 'Working sets', detail: '3–4 sets × 6–12 reps', minutes: 15 },
      { label: 'Cool down', detail: 'Chest and shoulder stretching', minutes: 4 },
    ],
    dose: '3–4 sets × 6–12 reps, 90 seconds rest. Start with support holds and negatives if full dips are out of reach.',
    frequency: '2 sessions a week.',
    safety: [
      'Stop the descent at the point where your shoulder still feels strong, not where your elbows say you can go.',
      'Front-of-shoulder pain means shorten the range or come off dips entirely for now.',
    ],
    videoQuery: 'parallel bar dips proper form',
  },
  {
    equipment: 'suspension',
    summary: 'Two adjustable straps with handles, anchored overhead. Your body angle sets the difficulty, so one tool covers absolute beginner to very hard.',
    trains: ['Whole body', 'Core', 'Pulling strength'],
    steps: [
      'Anchor it to a solid overhead point and pull down hard on both straps to test it before trusting it.',
      'Set both straps to the same length — check the markings, uneven straps twist you.',
      'Take the handles and walk your feet toward the anchor to make an exercise harder, away to make it easier.',
      'Set your body in one straight line from ear to ankle and keep it there for the whole set.',
      'Move slowly. The straps expose every wobble, and that is the point.',
      'Reset your line between reps rather than sagging through the set.',
    ],
    plan: [
      { label: 'Anchor and warm up', detail: 'Test the anchor, set strap length, one easy set', minutes: 5 },
      { label: 'Working sets', detail: '3–4 rounds of a row, a press and a core hold', minutes: 18 },
      { label: 'Cool down', detail: 'Stretching', minutes: 4 },
    ],
    dose: '3–4 sets × 8–15 reps, adjusting difficulty by foot position rather than reps. 60 seconds rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Test the anchor with your full weight, close to the floor, before every session.',
      'Never anchor to a door that opens toward you.',
    ],
    videoQuery: 'suspension trainer TRX beginner workout form',
  },
  {
    equipment: 'ab_wheel',
    summary: 'A small wheel with handles through the axle. One of the hardest core tools there is, and the easiest to hurt your back with.',
    trains: ['Core', 'Lats', 'Shoulders'],
    steps: [
      'Kneel on a mat with the wheel under your shoulders and your hands directly on top of it.',
      'Tuck your hips slightly under and brace hard — your ribs should feel pulled down toward your hips.',
      'Roll forward only as far as you can keep your lower back flat. For most people that is much less than the floor.',
      'Stop the moment your hips start to sag or your back starts to arch. That is your range for now.',
      'Pull the wheel back with your core and lats, not by yanking with your arms.',
      'Start with a wall as a stopper a foot in front of you and move it further away over the weeks.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Dead bugs and planks to switch the core on', minutes: 5 },
      { label: 'Working sets', detail: '3 sets × 5–10 controlled rollouts', minutes: 8 },
      { label: 'Cool down', detail: 'Cat-cow and hip flexor stretch', minutes: 3 },
    ],
    dose: '3 sets × 5–10 reps, 90 seconds rest. Range before reps, always.',
    frequency: '2 sessions a week, never on consecutive days at first.',
    safety: [
      'A sagging lower back is the injury. End the set at the first sag, not at a rep count.',
      'Skip this entirely if you have current lower-back pain and use dead bugs instead.',
    ],
    videoQuery: 'ab wheel rollout proper form beginner',
  },
  {
    equipment: 'stability_ball',
    summary: 'A large inflatable ball that makes any movement unstable on purpose. Good for core work, hamstring curls and supported back extensions.',
    trains: ['Core', 'Hamstrings', 'Balance'],
    steps: [
      'Inflate it so that sitting on it puts your knees at about 90° — an under-inflated ball is harder to control, not easier.',
      'Use it on a non-slip floor with clear space around you.',
      'Get on it slowly with a hand on the floor or a wall for the first few sessions.',
      'Find the position where the ball is still, then start the movement.',
      'Move slowly and stop the set as soon as the wobble takes over the movement.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Check pressure, easy balance holds', minutes: 4 },
      { label: 'Working sets', detail: '3 sets × 10–15 reps of curls, planks or crunches', minutes: 14 },
      { label: 'Cool down', detail: 'Stretching over the ball', minutes: 4 },
    ],
    dose: '3 sets × 10–15 reps or 30–45 second holds, 60 seconds rest.',
    frequency: '2–3 sessions a week.',
    safety: [
      'Never load a barbell while lying on a stability ball.',
      'Check the ball for scuffs and keep it away from anything sharp.',
    ],
    videoQuery: 'stability ball exercises core proper form',
  },
  {
    equipment: 'medicine_ball',
    summary: 'A weighted ball you can throw, slam and rotate with. The tool for explosive and rotational work that dumbbells cannot do safely.',
    trains: ['Core', 'Obliques', 'Power', 'Conditioning'],
    steps: [
      'Pick a weight light enough to move fast — power work is about speed, not load.',
      'Check what is behind and above you. Slams bounce, and throws travel.',
      'Set your feet about shoulder-width and brace your middle.',
      'Move fast on the throwing or slamming half of the rep and take your time resetting.',
      'For rotational throws, turn through the hips and let the shoulders follow.',
      'Take full rest between sets — quality drops fast, and slow power reps are pointless.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Light rotations and easy throws', minutes: 5 },
      { label: 'Working sets', detail: '4–6 sets × 5–8 fast reps, full rest', minutes: 12 },
      { label: 'Cool down', detail: 'Thoracic and hip stretching', minutes: 3 },
    ],
    dose: '4–6 sets × 5–8 explosive reps, 60–90 seconds rest.',
    frequency: '1–2 sessions a week, on days you are fresh.',
    safety: [
      'A hard slam ball bounces back at your face. Use a proper non-bounce ball indoors.',
      'Never do power work when you are already fatigued.',
    ],
    videoQuery: 'medicine ball slams rotational throws form',
  },
  {
    equipment: 'jump_rope',
    summary: 'The cheapest, most portable conditioning tool there is, and it improves foot speed and calf stiffness as a bonus.',
    trains: ['Cardio', 'Calves', 'Coordination'],
    steps: [
      'Set the length: stand on the middle of the rope and the handles should reach roughly your armpits.',
      'Skip on a forgiving surface — wood, rubber or a mat, never concrete if you can help it.',
      'Hold the handles at hip height, elbows close to your ribs.',
      'Turn the rope with your wrists, not your arms. Big arm circles are the most common mistake.',
      'Jump about two centimetres off the floor and land softly through the balls of your feet.',
      'Build up in short rounds rather than one long grinding effort.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Ankle circles, calf raises, easy bouncing', minutes: 4 },
      { label: 'Rounds', detail: '8–10 rounds of 45 s skipping, 30 s rest', minutes: 12 },
      { label: 'Cool down', detail: 'Calf and Achilles stretching', minutes: 4 },
    ],
    dose: '8–10 rounds of 45 seconds with 30 seconds rest. Beginners: 20 seconds on, 40 off.',
    frequency: '2–4 sessions a week, building slowly — calves and Achilles need time to adapt.',
    safety: [
      'Sore Achilles or shins means cut the volume immediately; this is where skipping injuries come from.',
      'Trainers with cushioning, and never barefoot on a hard floor.',
    ],
    videoQuery: 'jump rope technique for beginners',
  },
  {
    equipment: 'box',
    summary: 'A sturdy raised platform for step-ups, box jumps and elevated presses. Height changes everything about how hard it is.',
    trains: ['Legs', 'Glutes', 'Power'],
    steps: [
      'Test the box takes your weight and does not slide before the first rep.',
      'Pick a height where you can step up with your whole foot on the surface.',
      'For step-ups, drive through the heel of the top foot and stand fully tall.',
      'For jumps, land quietly with soft knees in the same position you took off from.',
      'Step down from box jumps — never jump down, that is where knees and Achilles get hurt.',
      'Stop jump sets when the landings stop being quiet.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Bodyweight squats and low step-ups', minutes: 5 },
      { label: 'Working sets', detail: '4–5 sets × 3–5 jumps, or 3 × 10 step-ups per leg', minutes: 14 },
      { label: 'Cool down', detail: 'Quad and calf stretching', minutes: 4 },
    ],
    dose: 'Jumps: 4–5 sets × 3–5 reps, full rest. Step-ups: 3 sets × 10 per leg.',
    frequency: 'Jumps 1–2 times a week; step-ups up to 3.',
    safety: [
      'Always step down. Jumping down multiplies the landing force for no benefit.',
      'Shins get shredded by a missed box jump — start far lower than your ego suggests.',
    ],
    videoQuery: 'box jump and step up proper form',
  },
  {
    equipment: 'foam_roller',
    summary: 'A dense foam cylinder you lie on to work through tight areas. It will not change tissue length, but it does reliably make an area feel and move better for a while.',
    trains: ['Mobility', 'Warm-up', 'Recovery'],
    steps: [
      'Place the roller under the muscle you want — never directly on a joint or on your lower back.',
      'Support your weight with your hands and the free leg so you can control the pressure.',
      'Roll slowly, about two centimetres a second. Fast rolling does nothing.',
      'When you find a tender spot, stop and hold there for 20 to 30 seconds and keep breathing.',
      'Give each area 60 to 90 seconds, then move on.',
      'Follow it immediately with the movement you were about to do — rolling is a doorway, not the room.',
    ],
    plan: [
      { label: 'Upper body', detail: 'Mid-back and lats', minutes: 3 },
      { label: 'Lower body', detail: 'Quads, glutes, calves, hip flexors', minutes: 6 },
      { label: 'Move', detail: 'Take the new range straight into mobility work', minutes: 3 },
    ],
    dose: '60–90 seconds per area, holding 20–30 seconds on tender spots.',
    frequency: 'Daily if you like — before training, or on rest days.',
    safety: [
      'Never roll directly on your lower back, your neck, or the back of your knee.',
      'Uncomfortable is fine. Sharp, electric or numbing is not — come off it.',
    ],
    videoQuery: 'foam rolling technique full body',
  },
  {
    equipment: 'hand_gripper',
    summary: 'A spring-loaded hand tool you squeeze shut. Trains crushing grip, which carries directly into deadlifts, rows and carries.',
    trains: ['Grip', 'Forearms'],
    steps: [
      'Seat the gripper deep in your palm with the handle across the base of your fingers, not out on the fingertips.',
      'Set your wrist straight — bent wrists cost you strength and irritate the joint.',
      'Squeeze until the handles touch, or as close as you can get.',
      'Hold the closed position for a second, then open slowly over two to three seconds.',
      'Stop the set when the handles no longer touch on a rep.',
      'Train the opposite direction too — a rubber band round your fingertips, opening against it.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Wrist circles and easy squeezes', minutes: 2 },
      { label: 'Working sets', detail: '3–4 sets × 8–12 reps per hand', minutes: 6 },
      { label: 'Balance and stretch', detail: 'Band finger extensions and forearm stretch', minutes: 3 },
    ],
    dose: '3–4 sets × 8–12 reps per hand, 60 seconds rest.',
    frequency: '2–3 non-consecutive days a week. Grip recovers slowly.',
    safety: [
      'Elbow or wrist pain is the signal to stop — golfer’s elbow is the classic gripper injury.',
      'Always train finger extension as well, or you build an imbalance.',
    ],
    videoQuery: 'hand gripper training technique forearm',
  },
  {
    equipment: 'treadmill',
    summary: 'A motorised belt for walking, running and incline work in a controlled, weather-proof way.',
    trains: ['Cardio', 'Legs'],
    steps: [
      'Clip the safety key to your clothing before you start it. Every time.',
      'Straddle the belt, start it slow, and step on once it is moving steadily.',
      'Walk for three to five minutes to warm up before any faster work.',
      'Look ahead, not down at your feet, and let your arms swing naturally.',
      'Hold the rails only for balance, never to take your weight — that makes the numbers lie.',
      'Slow it right down for three to five minutes at the end rather than jumping straight off.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Easy walking, building pace', minutes: 5 },
      { label: 'Main effort', detail: 'Steady run, or intervals of 1 min hard / 2 min easy', minutes: 20 },
      { label: 'Cool down', detail: 'Slow walking and calf stretching', minutes: 5 },
    ],
    dose: '20–30 minutes steady, or 6–10 intervals of 1 minute hard with 2 minutes easy.',
    frequency: '2–4 sessions a week.',
    safety: [
      'The safety key is not optional, and neither is checking behind you before stepping off.',
      'Incline work loads the calves and Achilles hard — build it up over weeks.',
    ],
    videoQuery: 'treadmill running form and settings guide',
  },
  {
    equipment: 'bike',
    summary: 'A stationary bicycle for low-impact cardio. Kind to knees and ankles, and the easiest place to do hard intervals safely.',
    trains: ['Cardio', 'Quads', 'Glutes'],
    steps: [
      'Set the saddle height so your knee stays slightly bent at the bottom of the pedal stroke.',
      'Set the saddle fore and aft so your front knee sits over the pedal axle when the cranks are level.',
      'Set the handlebars where your back is comfortable and your shoulders are not hunched.',
      'Start with five minutes of easy spinning at a high cadence and low resistance.',
      'Aim to keep a cadence around 80–100 rpm rather than grinding a huge gear slowly.',
      'Spin easy for five minutes at the end to clear your legs.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Easy spinning, low resistance', minutes: 5 },
      { label: 'Main effort', detail: 'Steady ride, or 8 × 30 s hard / 90 s easy', minutes: 20 },
      { label: 'Cool down', detail: 'Easy spin and quad stretch', minutes: 5 },
    ],
    dose: '20–40 minutes steady, or 8–10 intervals of 30 seconds hard with 90 seconds easy.',
    frequency: '2–5 sessions a week.',
    safety: [
      'Knee pain almost always means the saddle is too low or too far forward.',
      'Adjust the setup before you add resistance, not after.',
    ],
    videoQuery: 'stationary bike setup saddle height guide',
  },
  {
    equipment: 'rower',
    summary: 'A full-body cardio machine with a real technical skill to it. Done properly it is legs, back and arms; done badly it is just a sore lower back.',
    trains: ['Cardio', 'Back', 'Legs', 'Core'],
    steps: [
      'Set the damper to about 3–5 — high numbers are not "harder training", just slower.',
      'Strap your feet so the strap crosses the ball of the foot.',
      'Start the drive with your legs only, arms straight and back braced.',
      'When the handle passes your knees, swing the torso back slightly, then finally pull with the arms to your lower ribs.',
      'Reverse the order to come back: arms away, body over, then bend the knees.',
      'Keep the ratio roughly one count on the drive to two on the recovery.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Easy rowing, drills at half slide', minutes: 5 },
      { label: 'Main effort', detail: 'Steady piece, or 4 × 500 m with 2 min rest', minutes: 20 },
      { label: 'Cool down', detail: 'Easy rowing and back stretching', minutes: 5 },
    ],
    dose: '20–30 minutes steady, or 4–6 × 500 m intervals with 2 minutes rest.',
    frequency: '2–4 sessions a week.',
    safety: [
      'Legs, then body, then arms. Pulling with the arms first is what wrecks lower backs on a rower.',
      'Never round your back at the catch to reach further forward.',
    ],
    videoQuery: 'rowing machine technique legs body arms',
  },
  {
    equipment: 'elliptical',
    summary: 'A low-impact machine where your feet never leave the pedals. The gentlest option for cardio when joints are complaining.',
    trains: ['Cardio', 'Legs', 'Glutes'],
    steps: [
      'Step on with the pedals level and hold the fixed rails while you find the rhythm.',
      'Stand tall — leaning on the handles takes the work out of your legs.',
      'Push through the whole foot rather than dropping onto your toes.',
      'Use the moving handles to bring the upper body in, or hold the fixed rail to keep it all in the legs.',
      'Change resistance and incline over the session so the same muscles are not doing everything.',
      'Slow down gradually for the last few minutes.',
    ],
    plan: [
      { label: 'Warm up', detail: 'Low resistance, easy pace', minutes: 5 },
      { label: 'Main effort', detail: 'Steady, or alternating 2 min hard / 2 min easy', minutes: 20 },
      { label: 'Cool down', detail: 'Easy pedalling and stretching', minutes: 5 },
    ],
    dose: '20–40 minutes, keeping a pace where you could speak in short sentences.',
    frequency: '2–5 sessions a week.',
    safety: [
      'Numb toes usually means you are leaning forward on your toes — stand taller and press through the heel.',
      'Do not hang off the handles; the effort reading becomes meaningless.',
    ],
    videoQuery: 'elliptical trainer proper form technique',
  },
  {
    equipment: 'band_set',
    summary:
      'The boxed kit sold as an "11pc resistance bands set": five colour-coded tubes that clip together to stack resistance, two handles, a door anchor and a pair of ankle straps. Anchored to a door it covers most of what a cable machine does, for the price of a cheap dinner and the space of a shoebox.',
    trains: ['Full body', 'Chest', 'Back', 'Shoulders', 'Arms', 'Glutes', 'Legs'],
    steps: [
      'Lay the kit out and check every tube: hold it up to the light and look for nicks, splits or cloudy patches near the metal clips. A tube that snaps under load whips back at your face. Bin a damaged one — do not "get one more session" out of it.',
      'Pick your resistance by stacking, not straining. Clip one tube to each end of the handle for light work; add a second and a third to the same clips to go heavier. The colours are printed with their poundage on the clip.',
      'Set the door anchor. Push the foam ball through to the far side of the door and pull the strap back so the ball sits flat against the outside face — high for pulldowns, chest height for presses and rows, low at the floor for curls and kickbacks.',
      'Close the door and check it opens away from you. If the door swings towards you, the anchor is on the pull side and the door will fly open into your face. Lock it if you can.',
      'Clip the tubes to the anchor loop, then the handles or ankle cuffs to the other end. Tug each carabiner hard before you trust it — the gate should be fully closed, not caught on the webbing.',
      'For ankle work, wrap the cuff padded-side against your skin just above the ankle bone, snug enough that one finger just slides underneath.',
      'Step away from the anchor until there is already tension at the start position. A band with slack does nothing for the first third of the rep.',
      'Set your stance: feet split, front knee soft, ribs down, middle braced. Bands pull you back toward the anchor, so you need a base that resists it.',
      'Move against the resistance at a steady count, and control the way back over about three seconds. The return is where bands build most of their strength — letting it snap back wastes half the rep.',
      'Keep the tube clear of the door edge, the frame and your own skin. A tube dragged across a sharp edge is the one that fails next week.',
      'Unclip and release the tension deliberately at the end of the set. Never let a loaded handle go.',
    ],
    plan: [
      { label: 'Set up and warm up', detail: 'Rig the anchor, check the tubes, then a light tube for pull-aparts and band dislocates', minutes: 6 },
      { label: 'Main work', detail: 'Four to six anchored moves — a press, a row, a pulldown, a curl or pressdown, and something for the hips', minutes: 22 },
      { label: 'Finish', detail: 'One high-rep pump set and a stretch using the band as an assist', minutes: 6 },
    ],
    dose: '3–4 sets of 12–20 reps per movement. Bands get harder as they stretch, so pick a stack you could just about do 20 with and stop 2 reps short of failing.',
    frequency: '3–5 sessions a week. The low joint load means you can train more often than with heavy free weights.',
    safety: [
      'Never anchor to a door that opens towards you, and never to a handle, a radiator or a bannister. Doors and rails have failed and the metal clip travels at eye height.',
      'Inspect every tube before every session. Latex degrades with sunlight, heat and sweat — most snaps are on a tube somebody already knew was cracked.',
      'Keep your face out of the line of the tube. Set up beside the path of the band, never directly along it.',
      'Do not stack more tubes than the handle clip is rated for; the clip fails before the tube does.',
      'Stretching a tube past roughly two and a half times its resting length is where the risk climbs steeply. If it feels tight before you have started the rep, step in.',
      'Store it out of direct sunlight and away from radiators. A bag in a cupboard, not a windowsill.',
    ],
    videoQuery: 'resistance band set door anchor setup full body workout',
  },
];

export const EQUIPMENT_GUIDES: Record<string, EquipmentGuide> =
  Object.fromEntries(GUIDES.map((g) => [g.equipment, g]));

export function equipmentGuideFor(equipment: Equipment): EquipmentGuide | null {
  return EQUIPMENT_GUIDES[equipment] ?? null;
}

/** Total recommended minutes for one session with the kit. */
export function guideMinutes(guide: EquipmentGuide): number {
  return guide.plan.reduce((total, row) => total + row.minutes, 0);
}

/**
 * A YouTube search rather than a pinned video id: a fixed id rots the moment
 * the uploader takes it down, and a search stays current and regional.
 * Null when the guide declares that no video would help.
 */
export function equipmentVideoUrl(guide: EquipmentGuide): string | null {
  if (!guide.videoQuery) return null;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(guide.videoQuery)}`;
}

/** Library exercises that need this piece of kit, for onward links. */
export function exercisesUsing(equipment: Equipment, limit = 6) {
  // A bundled kit should list what its parts unlock, not an empty shelf.
  const parts = new Set<Equipment>([equipment, ...(IMPLIED_EQUIPMENT[equipment] ?? [])]);
  const owned = expandEquipment([equipment]);
  const soloable = (e: (typeof EXERCISES)[number]) => e.equipment.every((x) => owned.has(x));
  return EXERCISES
    .filter((e) => e.equipment.some((x) => parts.has(x)))
    // Lead with what this kit does on its own — listing gym-only movements
    // first reads as a promise the kit cannot keep.
    .sort((a, b) => Number(soloable(b)) - Number(soloable(a)))
    .slice(0, limit);
}


/* ============================================================
   Goal routines
   The kit guide answers "what is this thing and how do I not hurt
   myself". This answers the question people actually arrive with:
   "I own this — what do I do with it to get what I am after?"
   Authored per goal, because the same kit run three different ways
   produces three different results.
   ============================================================ */

export interface GoalRoutineStep {
  title: string;
  detail: string;
  /** The check that tells you the step worked. Without it a step is just a wish. */
  cue: string;
}

export interface EquipmentGoalRoutine {
  equipment: Equipment;
  headline: string;
  /** Why this shape of session serves this goal. */
  why: string;
  steps: GoalRoutineStep[];
  dose: string;
  weekly: string;
  /** Stated plainly where the kit is a compromise for this goal. */
  caveat: string | null;
}

/** Goals that share a routine, so the table stays honest instead of padded. */
type RoutineKey = 'lose_fat' | 'build_muscle' | 'gain_strength' | 'improve_endurance' | 'mobility' | 'balanced';

const ROUTINE_KEY: Record<GoalKind, RoutineKey> = {
  lose_fat: 'lose_fat',
  build_muscle: 'build_muscle',
  gain_strength: 'gain_strength',
  improve_endurance: 'improve_endurance',
  mobility: 'mobility',
  general_fitness: 'balanced',
  maintain: 'balanced',
};

const BAND_SET_ROUTINES: Record<RoutineKey, Omit<EquipmentGoalRoutine, 'equipment'>> = {
  lose_fat: {
    headline: 'Circuit the whole body, keep the rest short',
    why: 'Fat loss is won on the calorie side, but training decides whether what you lose is fat or muscle. Short rests keep the heart rate up; hitting every major muscle tells your body to keep the muscle it has.',
    steps: [
      {
        title: 'Rig the anchor at chest height and pick a middle stack',
        detail: 'Two tubes on each handle. You want a load you could manage for 20 reps, not one that has you grinding at 8 — you are going to come back to it four times.',
        cue: 'Rep 15 of the first round should feel easy. If it does not, drop a tube now rather than falling apart in round three.',
      },
      {
        title: 'Run five moves back to back with no rest between them',
        detail: 'Chest press, row, squat with the tube under both feet, overhead press, then kickbacks with the ankle cuff. Move straight from one to the next — the changeover is your rest.',
        cue: 'You should be breathing hard enough that talking comes in short sentences, not gasping and not comfortable.',
      },
      {
        title: 'Rest 90 seconds at the end of the round, then go again',
        detail: 'Four rounds total. Set a timer and obey it; resting by feel always drifts longer as you tire.',
        cue: 'If round four takes noticeably longer than round one, the stack was too heavy, not your willpower.',
      },
      {
        title: 'Finish with one long set to empty the tank',
        detail: 'Lightest tube, high-rep pull-aparts or squats to 25–30 reps. Cheap extra work that costs nothing in recovery.',
        cue: 'A burn, not a strain. Stop if form breaks.',
      },
      {
        title: 'Log it and leave the deficit to the kitchen',
        detail: 'Do not add extra sessions to chase a stall. Check the Nutrition page instead — a stalled cut is nearly always a calorie problem, not a training one.',
        cue: 'Weight trending down 0.4–1% a week means it is working. Flat for three weeks means the numbers need changing, not the workout.',
      },
    ],
    dose: '4 rounds of 5 movements, 12–20 reps each, 90 seconds rest between rounds only.',
    weekly: '3–4 sessions a week on non-consecutive days.',
    caveat: null,
  },
  build_muscle: {
    headline: 'Stack the tubes, slow the way back, chase the last few reps',
    why: 'Muscle responds to hard sets taken close to failure and to time under tension. Bands get harder the further you stretch them, which suits this better than it suits anything else.',
    steps: [
      {
        title: 'Stack up until 12 reps is genuinely hard',
        detail: 'Clip a second and third tube to the same handle. The set should have you slowing down by rep 10 and finishing at about rep 12–15 with two left in you.',
        cue: 'If you can rattle off 20 clean reps, add a tube. Bands are too easy to under-load.',
      },
      {
        title: 'Take three seconds on every return',
        detail: 'The stretch back to the start is where band training does most of its damage, in the good sense. Count it: one, two, three, then press or pull again.',
        cue: 'You should feel the working muscle resisting the whole way back, never the band yanking your arm home.',
      },
      {
        title: 'Two anchored pushes, two anchored pulls, every session',
        detail: 'Chest press and overhead press; row and pulldown. Balance matters more here than novelty — the pulls keep your shoulders healthy enough to keep pressing.',
        cue: 'Pulls should total at least as many sets as pushes across the week.',
      },
      {
        title: 'Step further from the anchor to add load without adding tubes',
        detail: 'A half step back meaningfully increases tension at the start of the rep. It is the finest adjustment this kit has, and it is free.',
        cue: 'There must already be tension before you begin the rep. Slack at the start means the first third does nothing.',
      },
      {
        title: 'Add a set or a half step every week or two',
        detail: 'Progression is the whole point. Same stack, same reps, forever, gives you what you already have.',
        cue: 'If nothing has gone up in three weeks — reps, sets, tubes or distance from the anchor — you are maintaining, not building.',
      },
    ],
    dose: '3–4 sets of 10–15 reps per movement, 60–90 seconds rest, stopping about 2 reps short of failure.',
    weekly: '3–4 sessions a week, each muscle hit twice.',
    caveat: 'Bands cap out. Once the heaviest stack gives you 20 easy reps, this kit can maintain the muscle you have built but will struggle to add much more — that is the point to add dumbbells rather than more tubes.',
  },
  gain_strength: {
    headline: 'Heaviest stack, low reps, full rest — and be honest about the ceiling',
    why: 'Strength is a skill practised under heavy load with full recovery between efforts. Bands can build it early on, and the accommodating resistance is genuinely useful for lockout strength.',
    steps: [
      {
        title: 'Stack every tube you own onto one handle',
        detail: 'For strength work you want a load where 6 reps is a real fight. With this kit that usually means all five tubes and standing well back from the anchor.',
        cue: 'Rep 6 should be slow and grinding. If rep 6 is smooth, this is muscle-building work, not strength work.',
      },
      {
        title: 'Pick three or four movements and stay on them for weeks',
        detail: 'Anchored press, row, pulldown, and a squat with the tube under both feet. Strength comes from repeating the same lift, not from variety.',
        cue: 'You should know last week\'s numbers before you start today\'s session.',
      },
      {
        title: 'Rest two to three full minutes between sets',
        detail: 'Longer than feels necessary. You are recovering the nervous system, not catching your breath — cutting rest turns a strength session into a conditioning one.',
        cue: 'Set two should be as strong as set one. If it drops off sharply, you rested too little.',
      },
      {
        title: 'Drive fast out of the stretch, control the return',
        detail: 'Intent to move the load quickly is what trains strength, even when the band means it does not actually move fast.',
        cue: 'The first inch should be sharp. A slow, tentative start trains hesitation.',
      },
      {
        title: 'Pair it with something that loads you heavily',
        detail: 'Use the bands for volume and lockout work, and get under real load — dumbbells, a barbell, or your own bodyweight on dips and chin-ups — for the heavy end.',
        cue: 'Progress in strength shows up as more load, not more reps. If load cannot go up, strength will plateau.',
      },
    ],
    dose: '4–5 sets of 5–8 hard reps, 2–3 minutes rest.',
    weekly: '3 sessions a week, never two heavy days back to back.',
    caveat: 'This is the goal a band set serves worst. Tension peaks at the end of the range and nearly disappears at the start, which is the opposite of what a heavy lift demands. Expect real progress for a few months as a beginner, then a genuine ceiling.',
  },
  improve_endurance: {
    headline: 'Long sets, light stack, keep moving',
    why: 'Muscular endurance is built by staying under load far longer than a strength set allows. A light tube lets you keep going well past the point a dumbbell would force you to stop.',
    steps: [
      {
        title: 'Pick the lightest tube that still makes 25 reps a challenge',
        detail: 'One tube, sometimes two. The goal is sustained work, not a fight.',
        cue: 'You should reach rep 20 with form intact and rep 30 wanting to stop.',
      },
      {
        title: 'Work in long continuous blocks, not short sets',
        detail: 'Three minutes on one movement, straight through, changing tempo rather than stopping. Then move on.',
        cue: 'Breathing steady and rhythmic. If you are holding your breath, the stack is too heavy for this.',
      },
      {
        title: 'Alternate an upper move with a lower move',
        detail: 'While the legs work the arms recover, so you can keep going far longer without either giving out.',
        cue: 'You should never need to stop entirely — only to switch.',
      },
      {
        title: 'Add a minute a week before you add a tube',
        detail: 'For endurance, duration is the progression. Load comes last.',
        cue: 'Same stack, more total time under it, week over week.',
      },
      {
        title: 'Keep this separate from your hard cardio days',
        detail: 'Bands complement running or cycling; they do not replace the aerobic work that actually drives endurance.',
        cue: 'If this session leaves you too tired to run well tomorrow, it was too hard.',
      },
    ],
    dose: '3-minute blocks per movement, 20–35 reps a set, minimal rest, 25–35 minutes total.',
    weekly: '2–3 sessions a week alongside your main cardio.',
    caveat: 'A band set builds muscular endurance well and cardiovascular endurance barely at all. The heart and lungs still need running, cycling, rowing or brisk walking.',
  },
  mobility: {
    headline: 'Lightest tube, assisted range, no load worth mentioning',
    why: 'For mobility the band is a guide and a gentle assist, not resistance. It helps you reach positions you cannot yet hold on your own and gives your joints something to stabilise against.',
    steps: [
      {
        title: 'Use one tube only, the lightest in the box',
        detail: 'Anything heavier turns a mobility drill into a strength exercise and you lose the range you came for.',
        cue: 'You should be able to hold the end position and breathe normally.',
      },
      {
        title: 'Shoulder dislocates and pull-aparts to open the chest',
        detail: 'Wide grip, arms straight, take the band slowly overhead and behind. Narrow the grip over the weeks as the range improves.',
        cue: 'Elbows stay locked. Bending them is borrowing range you have not earned.',
      },
      {
        title: 'Anchor low and use the tube to traction a joint',
        detail: 'Loop it round the hip or shoulder and lean away so it gently pulls the joint into its socket while you move through the range.',
        cue: 'A stretch, never a pinch. Sharp or pointed sensations mean stop.',
      },
      {
        title: 'Hold end positions for 30 seconds, not 3',
        detail: 'Range comes from time spent at the edge of it, not from bouncing at it.',
        cue: 'The last 10 seconds should feel easier than the first — that is the tissue letting go.',
      },
      {
        title: 'Do it most days, briefly',
        detail: 'Ten focused minutes daily beats an hour once a week by a distance.',
        cue: 'You should finish feeling looser than when you started, never sore.',
      },
    ],
    dose: '2–3 sets of 30–60 seconds or 10–15 slow reps per drill, 10–15 minutes total.',
    weekly: '4–7 short sessions a week.',
    caveat: null,
  },
  balanced: {
    headline: 'Push, pull, hinge, squat — cover everything, twice a week',
    why: 'With no single goal pulling the session one way, the job is coverage: every major pattern trained regularly enough to keep it, at an effort you can repeat for years.',
    steps: [
      {
        title: 'Anchor at chest height and pick a stack you could do 15 with',
        detail: 'Two tubes suits most people starting out. Comfortable is fine here — consistency is the point, not intensity.',
        cue: 'You should finish each set thinking you had 3 or 4 more in you.',
      },
      {
        title: 'One push, one pull, one squat, one hip hinge, every session',
        detail: 'Chest press, row, band squat, and a good morning or kickback with the ankle cuff. Four movements covers the whole body.',
        cue: 'Nothing gets skipped because it is the boring one. The skipped pattern is the one that gets injured.',
      },
      {
        title: 'Three sets of each, a minute between',
        detail: 'About 25 minutes all in. Short enough that you will actually do it on a bad week.',
        cue: 'Finish feeling worked, not wrecked.',
      },
      {
        title: 'Add a little every few weeks',
        detail: 'A rep, a set, half a step further from the anchor. Small and steady beats heroic and abandoned.',
        cue: 'Compare against a month ago, not against last session.',
      },
      {
        title: 'Keep the ankle cuffs in rotation',
        detail: 'They are the part of the kit that gets left in the box, and hip work is the part most home training misses.',
        cue: 'At least one hip movement in every session.',
      },
    ],
    dose: '3 sets of 12–15 reps per movement, about 60 seconds rest.',
    weekly: '2–3 sessions a week.',
    caveat: null,
  },
};

/** Routines by kit. Only authored where the answer genuinely differs by goal. */
const GOAL_ROUTINES: Partial<Record<Equipment, Record<RoutineKey, Omit<EquipmentGoalRoutine, 'equipment'>>>> = {
  band_set: BAND_SET_ROUTINES,
};

/**
 * The goal-shaped routine for a piece of kit, or null where FitHub has nothing
 * specific to say. Returning null is deliberate: a generic routine dressed up
 * as goal-specific advice is worse than admitting there is none.
 */
export function equipmentGoalRoutine(equipment: Equipment, goal: GoalKind): EquipmentGoalRoutine | null {
  const table = GOAL_ROUTINES[equipment];
  if (!table) return null;
  return { equipment, ...table[ROUTINE_KEY[goal]] };
}

/** True when this kit has goal-specific routines at all. */
export function hasGoalRoutine(equipment: Equipment): boolean {
  return GOAL_ROUTINES[equipment] !== undefined;
}
