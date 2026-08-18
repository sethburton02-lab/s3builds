/* Where each champion's face sits down their splash, as a percentage of
   the image height. Keyed by Classic champion id (60000 + live key).

   Measured against THE SKIN THE SITE ACTUALLY SHOWS. That matters: the
   loader prefers a champion's Classic skin, and for half the roster that
   is a different painting from the base splash — Kayle's is the 2012
   art. Measuring the base skin and displaying the Classic one is what
   put several faces out of frame.

   The probe is the champion icon: a tight, face-centred crop, located in
   the splash by normalised cross-correlation over position and scale.
   Where that correlates weakly, the value was read off a ruled splash by
   eye instead. Re-verify by rendering the banner strips.

   All 63 champions are measured; nothing is on a default. */
const CHAMP_FACE_Y = {
  "60001":25,
  "60002":28,
  "60004":18,
  "60009":37,
  "60010":27,
  "60011":18,
  "60012":32,
  "60013":36,
  "60014":17,
  "60015":22,
  "60016":22,
  "60017":45,
  "60018":28,
  "60019":52,
  "60020":22,
  "60021":13,
  "60022":24,
  "60023":33,
  "60024":21,
  "60025":28,
  "60026":25,
  "60027":29,
  "60028":30,
  "60029":32,
  "60030":22,
  "60031":42,
  "60032":27,
  "60033":38,
  "60034":31,
  "60035":22,
  "60036":18,
  "60037":15,
  "60038":26,
  "60040":22,
  "60041":20,
  "60042":31,
  "60044":22,
  "60045":57,
  "60053":38,
  "60054":24,
  "60055":30,
  "60059":24,
  "60062":25,
  "60063":16,
  "60064":32,
  "60067":22,
  "60072":34,
  "60074":43,
  "60075":22,
  "60076":18,
  "60079":13,
  "60080":16,
  "60081":26,
  "60084":30,
  "60085":46,
  "60086":26,
  "60089":20,
  "60090":16,
  "60096":36,
  "60098":26,
  "60099":22,
  "60103":31,
  "60117":36
};
/* Only a champion added after the last game-data export would land here. */
const champFaceY = id => CHAMP_FACE_Y[String(id)] ?? 22;
