/* ============================================================
   THE SEASON 3 RIFT, AS A SCHEMATIC

   Why this is drawn rather than fetched: Riot does not serve the Season 3
   minimap. Data Dragon returns 403 for map images on any old patch, and the
   mode's own map 453 minimap is not exposed on Community Dragon at any path
   worth trying. The only minimap that loads anywhere is the CURRENT one,
   which has Scuttle, different raptor and krug placement and differently
   shaped pits — so a Season 3 jungle route drawn on it would point at camps
   that are not there. A wrong map is worse than a plain one.

   Drawing it also buys the thing a screenshot could never give: every camp,
   lane and pit is a NAMED region with a position, so a plan can store "red"
   rather than a pair of pixel coordinates. A guide written today survives
   this file being redrawn, and a route can snap to a camp instead of
   landing near one.

   Coordinates are a 0-1000 square, origin top left, blue base bottom left
   and red base top right — the orientation every League player reads a
   minimap in. Guides store 0-1 so the art can change size without touching
   the data.

   ON THE POSITIONS: these are a careful reconstruction of the Season 3
   layout, not a measurement of it — there is no file to measure. They are
   deliberately data rather than drawing commands so a position that looks
   wrong on the page is a number to nudge here, in one place, rather than a
   path to redraw.
   ============================================================ */

/* ---- the backdrop ----

   SELF-HOSTED, DELIBERATELY, AND THE ONE EXCEPTION ON THIS SITE.

   Everywhere else Riot art is hotlinked from Data Dragon or Community
   Dragon, which is the arrangement the fan-content policy anticipates and
   keeps nothing of Riot's on this domain. This image cannot work that way:
   it lives on cmsassets.rgpub.io, which is referrer-locked and returns
   nothing to a request from s3builds.net. It was tested under every
   referrer policy -- plain, no-referrer, origin, unsafe-url and
   cache-busted -- against a Data Dragon control that loaded fine each time.

   So the choice was mirror it or go without, and the call was to mirror it.
   500x500, with the footer disclaimer already in place.

   This is Riot's own clean plate at 856px: no structure glyphs, no "30"
   spawn labels, no hourglasses, and sharper than the annotated one. It
   replaced a version this code had inpainted by hand, which was a passable
   repair but a repair nonetheless.

   It was checked against the annotated plate before being trusted, because
   a different crop would have moved all 44 places at once: whole-image
   correlation puts it at scale 500/856 and offset (0,0) -- the same framing
   at 1.712x the resolution -- so the measured fractions carry over
   untouched. The turret platforms drawn in this plate's terrain also fall
   under the structure markers, which were derived from the glow glyphs on
   the other image, so two unrelated sources agree.

   rift-season3.jpg stays beside it as the annotated original. It is the
   source every structure position was measured from, so it should not be
   deleted even though nothing renders it. */
const MAP_IMAGE = "art/rift-season3-clean.jpg";

/* ---- the centre of the map ----

   MEASURED FROM THE ARTWORK, anchored on hand-placed clicks.

   This value has been wrong twice, in two different ways, and both failures
   are worth keeping written down:

   1. Taken from the camps' blue/red pair midpoints. Once the camps had been
      symmetrised about that value they agreed with it to 0.00px BY
      CONSTRUCTION, so they could no longer test it. The evidence was
      circular and a real error hid under it.

   2. Fitted to the structure glyphs on the annotated plate. Residuals came
      out at 1.75px, which read as decisive and was not: the glyphs are a UI
      overlay, and fitting a centre to them absorbs whatever offset they
      carry. It landed 22px from the truth while looking ten times better
      than the previous attempt. A tight fit to the wrong features beats a
      loose fit to the right ones on every metric except correctness.

   What it rests on now: all 15 structures on BOTH sides were clicked on
   the platform squares in the terrain. That gives 15 genuine pairs, and
   their implied centres agree to a median absolute deviation of (1.2,
   2.4)px with a worst case of 14.9px. It is a median of fifteen direct
   measurements of the same quantity.

   The structures no longer depend on it at all, since both sides are
   measured rather than one being mirrored. It still sets the symmetry for
   the terrain and the camps. */
const MAP_CENTRE = [0.51111, 0.48819];
const MAP_SIZE   = 1000;    /* the SVG viewBox square */
const MAP_WORLD  = 14800;   /* world units across, for the wx/wz reference only */

/* ---- the camps ----

   Clicked by hand on the clean plate, both sides, at the size and with the
   icons they actually render with -- so each one was judged against the
   terrain it sits on rather than against a marker ring.

   THESE ARE THE CLICKS, UNTOUCHED. An earlier version averaged each camp
   with its partner rotated about MAP_CENTRE, on the reasoning that a pair is
   two measurements of one position and averaging halves the click error.
   That is true in principle and was worth about 5px. It is not applied,
   because a camp placed while looking at the rendered icon encodes a
   judgement about fit that an average quietly discards, and a position that
   does not match what was clicked is hard to trust or to check. The camps
   are therefore NOT exactly symmetric: the two sides differ by up to about
   20px, which is click noise, not map asymmetry.

   These positions retire three earlier generations: an original pass clicked
   on Riot's "30" spawn labels (and therefore biased by wherever those labels
   sat), plus two corrections of mine, one wrong and one undoing it. */
const MAP_CAMPS = [
  {key: "blue-greatwraith", side: "blue", fx: 0.18286, fy: 0.41714, r: 20, name: "Great Wraith", short: "GW", wx: 2200, wz: 8450},
  {key: "blue-buff", side: "blue", fx: 0.28286, fy: 0.44143, r: 26, name: "Ancient Golem", short: "B", wx: 3700, wz: 8000},
  {key: "blue-wolves", side: "blue", fx: 0.28571, fy: 0.55857, r: 22, name: "Wolves", short: "W", wx: 3800, wz: 6500},
  {key: "blue-wraiths", side: "blue", fx: 0.48611, fy: 0.64248, r: 22, name: "Wraiths", short: "Wr", wx: 6950, wz: 5450},
  {key: "blue-red", side: "blue", fx: 0.54, fy: 0.72286, r: 26, name: "Lizard Elder", short: "R", wx: 8000, wz: 4100},
  {key: "blue-golems", side: "blue", fx: 0.57857, fy: 0.81286, r: 22, name: "Golems", short: "G", wx: 8500, wz: 2820},
  {key: "red-greatwraith", side: "red", fx: 0.83753, fy: 0.56105, r: 20, name: "Great Wraith", short: "GW", wx: 12500, wz: 6500},
  {key: "red-buff", side: "red", fx: 0.75, fy: 0.53429, r: 26, name: "Ancient Golem", short: "B", wx: 10900, wz: 7080},
  {key: "red-wolves", side: "red", fx: 0.73857, fy: 0.42286, r: 22, name: "Wolves", short: "W", wx: 10900, wz: 9400},
  {key: "red-wraiths", side: "red", fx: 0.54, fy: 0.35, r: 22, name: "Wraiths", short: "Wr", wx: 8000, wz: 9500},
  {key: "red-red", side: "red", fx: 0.49, fy: 0.26571, r: 26, name: "Lizard Elder", short: "R", wx: 7050, wz: 11000},
  {key: "red-golems", side: "red", fx: 0.44, fy: 0.17, r: 22, name: "Golems", short: "G", wx: 6350, wz: 12100}
].map(c => ({...c, x: c.fx * MAP_SIZE, y: c.fy * MAP_SIZE}));

const MAP_PITS = [
  {key: "baron", fx: 0.35857, fy: 0.29857, rx: 54, ry: 38, name: "Baron Nashor", wx: 4900, wz: 10408},
  {key: "dragon", fx: 0.68571, fy: 0.66857, rx: 54, ry: 38, name: "Dragon", wx: 9900, wz: 4350}
].map(p => ({...p, x: p.fx * MAP_SIZE, y: p.fy * MAP_SIZE}));

/* ---- the terrain ----

   Traced by hand on Riot's Classic minimap with a wide brush, then made
   symmetric. The tracing is the guide; these numbers are not it verbatim.

   WHY SYMMETRY. Summoner's Rift is 180-degree rotationally symmetric about
   its centre: top lane IS bot lane rotated, the Baron arm of the river IS
   the Dragon arm rotated, blue base IS red base rotated. A hand drag is not
   symmetric, so tracing each half separately inherited the wobble twice and
   left the two bases visibly different sizes. Each pair is now averaged with
   its partner rotated about the measured centre and the other half generated
   from the result, which is both better looking AND closer to the real map.

   Lanes and river are centre lines with a width, because that is what one
   brush stroke gives you — change the brush, not a separate width table.
   Walls keep one traced half rotated onto the other rather than averaging
   blob to blob, which turned two slightly different rock clusters to mush.

   Same 0-1000 square as the camps, so a route snapping to a camp and a lane
   drawn under it share one coordinate space by construction. */
const MAP_LANES = [
  {key: "top", w: 54, d: "M 112.4 705.9 C 112 657.6 108.9 488.9 109.9 416 C 111 343.2 114.7 305.7 118.8 268.9 C 123 232.1 127.3 215.5 134.6 195.4 C 142 175.4 153.4 160.5 162.9 148.7 C 172.3 136.9 181.3 131.9 191.4 124.8 C 201.5 117.8 207.2 113 223.5 106.4 C 239.7 99.9 244.2 92.7 289 85.5 C 333.8 78.4 418.7 69.5 492.3 63.7 C 565.8 57.9 690.5 52.9 730.2 50.7"},
  {key: "bot", w: 54, d: "M 909.8 270.5 C 910.2 318.8 913.4 487.5 912.3 560.4 C 911.2 633.2 907.5 670.7 903.4 707.5 C 899.3 744.2 894.9 760.9 887.6 781 C 880.3 801 868.8 815.9 859.4 827.7 C 849.9 839.5 840.9 844.5 830.8 851.6 C 820.7 858.6 815 863.4 798.7 869.9 C 782.5 876.5 778 883.7 733.2 890.8 C 688.4 898 603.5 906.9 530 912.7 C 456.4 918.5 331.7 923.5 292.1 925.7"},
  {key: "mid", w: 57, d: "M 257.6 744.4 C 342.1 659 680.1 317.4 764.7 232"}
];

const MAP_RIVER = [
  {w: 66, d: "M 236.8 228.2 C 241.9 236.1 252 257.6 267.2 275.9 C 282.4 294.3 297.4 312.7 328 338.3 C 358.7 363.9 430.6 414.4 451.1 429.6"},
  {w: 66, d: "M 785.4 748.2 C 780.3 740.2 770.2 718.8 755 700.4 C 739.8 682.1 724.8 663.7 694.2 638.1 C 663.5 612.4 591.6 562 571.1 546.8"}
];

const MAP_BASES = [
  {key: "blue", d: "M 340.9 858.7 C 340.7 867.6 339.6 914.4 338.5 925.7 C 337.5 936.9 334.1 948.5 331.8 955.1 C 329.4 961.6 322.5 976.4 318.6 982 C 314.7 987.7 302.5 999.6 298.1 1003.2 C 293.6 1006.8 288.2 1010.4 280.4 1012.5 C 272.5 1014.6 251.3 1021 230.8 1021 C 210.4 1021.1 124.6 1015 105.1 1013.1 C 85.6 1011.2 72.4 1007.4 63.7 1004.8 C 55.1 1002.3 37.3 994.9 31.1 991.4 C 24.9 987.9 14.9 979.2 10.8 974.6 C 6.7 970.1 -0.7 958.9 -3.8 952.4 C -6.9 945.9 -13.5 927.9 -15.7 918.9 C -17.8 910 -21.5 885.9 -22.4 875.8 C -23.2 865.7 -23.5 843.6 -22.8 832.2 C -22.2 820.7 -18.2 788.6 -16.6 777.6 C -14.9 766.5 -10.8 745.4 -8.4 737.5 C -6 729.5 0.5 715.3 4.3 709.2 C 8.2 703.2 20.1 689.9 24.4 685.7 C 28.8 681.6 36.2 676.4 41.6 673.6 C 47 670.8 63.6 663.8 70.6 661.9 C 77.5 659.9 84.8 656 101.1 656.8 C 117.4 657.7 193.1 666.3 210.1 669.1 C 227.2 672 240.1 678.1 247.4 681.3 C 254.7 684.5 266.4 691.4 272.6 696.4 C 278.8 701.4 294.8 716.9 300.2 724.1 C 305.6 731.3 315.6 749.8 319.1 758 C 322.7 766.2 328.4 783.6 330.8 794.3 C 333.2 804.9 338.9 841.9 340 849.4 C 341.2 856.9 341 849.8 340.9 858.7 Z"},
  {key: "red", d: "M 681.4 117.7 C 681.5 108.8 682.6 61.9 683.7 50.7 C 684.7 39.5 688.1 27.9 690.5 21.3 C 692.8 14.7 699.7 0 703.6 -5.7 C 707.6 -11.3 719.7 -23.3 724.1 -26.8 C 728.6 -30.4 734 -34.1 741.8 -36.1 C 749.7 -38.2 771 -44.6 791.4 -44.7 C 811.9 -44.7 897.6 -38.6 917.1 -36.7 C 936.6 -34.9 949.9 -31 958.5 -28.4 C 967.1 -25.9 984.9 -18.5 991.1 -15 C 997.3 -11.5 1007.4 -2.8 1011.4 1.7 C 1015.5 6.3 1022.9 17.4 1026 23.9 C 1029.1 30.4 1035.7 48.5 1037.9 57.4 C 1040.1 66.4 1043.7 90.5 1044.6 100.6 C 1045.4 110.7 1045.7 132.7 1045.1 144.2 C 1044.4 155.6 1040.5 187.8 1038.8 198.8 C 1037.1 209.9 1033.1 230.9 1030.6 238.9 C 1028.2 246.9 1021.7 261.1 1017.9 267.1 C 1014.1 273.2 1002.1 286.5 997.8 290.6 C 993.4 294.8 986 300 980.6 302.7 C 975.2 305.5 958.6 312.6 951.6 314.5 C 944.7 316.5 937.4 320.4 921.1 319.6 C 904.9 318.7 829.2 310.1 812.1 307.2 C 795 304.4 782.1 298.2 774.8 295 C 767.5 291.9 755.8 284.9 749.6 280 C 743.5 275 727.4 259.5 722 252.3 C 716.6 245.1 706.7 226.6 703.1 218.4 C 699.5 210.2 693.8 192.8 691.4 182.1 C 689 171.5 683.4 134.5 682.2 127 C 681 119.4 681.2 126.6 681.4 117.7 Z"}
];

/* 21 traced clusters, each with its rotated partner. */
const MAP_WALLS = [
  {w: 20, d: "M 660 410 C 654.9 410.6 636.2 411 629.7 413.8 C 623.2 416.6 622.8 421 621.1 426.5 C 619.5 432 615.9 436.4 619.7 447 C 623.5 457.6 636.6 482.1 643.7 490.2 C 650.7 498.2 657 496.4 662.2 495.4 C 667.4 494.4 673.3 491.8 674.9 484.4 C 676.5 477.1 674.4 462.4 671.6 451.4 C 668.8 440.5 661.7 423 658.3 418.7 C 654.8 414.5 651.6 417.9 651 426 C 650.3 434.1 654.9 459.3 654.3 467.3 C 653.6 475.3 650.6 475.1 647 474.1 C 643.4 473.2 634.4 470.4 632.5 461.6 C 630.7 452.7 633.9 421.7 635.9 421 C 637.8 420.2 642.9 451.1 644.3 457.1"},
  {w: 20, d: "M 362.2 566.4 C 367.3 565.7 386.1 565.3 392.5 562.6 C 399 559.8 399.4 555.4 401.1 549.9 C 402.8 544.3 406.3 540 402.5 529.4 C 398.8 518.8 385.7 494.3 378.6 486.2 C 371.5 478.2 365.2 480 360 481 C 354.8 481.9 348.9 484.6 347.3 491.9 C 345.7 499.3 347.9 514 350.6 524.9 C 353.4 535.9 360.5 553.4 364 557.7 C 367.4 561.9 370.6 558.4 371.3 550.3 C 371.9 542.3 367.3 517.1 367.9 509.1 C 368.6 501.1 371.6 501.3 375.2 502.3 C 378.9 503.2 387.8 505.9 389.7 514.8 C 391.5 523.7 388.3 554.7 386.3 555.4 C 384.4 556.2 379.3 525.3 377.9 519.3"},
  {w: 20, d: "M 680 352.9 C 681.2 356.2 684.1 367.9 687 372.7 C 689.9 377.5 687.9 382.9 697.5 381.7 C 707.1 380.5 733.1 367.2 744.6 365.4 C 756.1 363.6 758.4 363.5 766.7 371.1 C 775 378.8 788 396.1 794.4 411.4 C 800.8 426.7 802.6 456.8 805.1 463 C 807.5 469.2 810.7 461 809 448.6 C 807.4 436.2 800.4 405.4 794.9 388.6 C 789.4 371.7 782.1 355.4 775.9 347.3 C 769.6 339.2 768 340.3 757.3 340.2 C 746.6 340 721.4 344.4 711.6 346.5 C 701.8 348.6 701.2 350.2 698.6 352.8 C 696 355.5 684.8 361.6 696 362.5 C 707.2 363.5 754.1 359.3 765.7 358.6"},
  {w: 20, d: "M 342.2 623.5 C 341.1 620.2 338.1 608.5 335.2 603.7 C 332.3 598.9 334.4 593.4 324.8 594.6 C 315.2 595.9 289.1 609.2 277.6 611 C 266.1 612.7 263.9 612.9 255.6 605.3 C 247.2 597.6 234.2 580.3 227.8 565 C 221.4 549.6 219.6 519.6 217.1 513.4 C 214.7 507.2 211.5 515.4 213.2 527.8 C 214.9 540.2 221.8 570.9 227.3 587.8 C 232.8 604.7 240.1 621 246.4 629.1 C 252.6 637.1 254.2 636.1 264.9 636.2 C 275.6 636.3 300.8 632 310.6 629.9 C 320.4 627.8 321.1 626.2 323.7 623.5 C 326.2 620.9 337.4 614.8 326.2 613.8 C 315 612.9 268.1 617.1 256.5 617.8"},
  {w: 20, d: "M 855.7 352.9 C 858.4 356.6 869.6 363.5 872.1 374.9 C 874.6 386.3 869.2 405.1 870.8 421.4 C 872.4 437.7 880.4 462.1 881.4 472.7 C 882.5 483.3 879.8 482.8 877.2 484.9 C 874.5 487.1 870.1 487.6 865.6 485.5 C 861.1 483.5 854.2 478 850.2 472.7 C 846.1 467.4 843.8 467 841.3 454 C 838.8 440.9 835.6 407.6 835.2 394.3 C 834.9 380.9 837.2 378.5 839.2 373.8 C 841.1 369.2 844.6 365.8 847 366.4 C 849.3 366.9 852.5 367.7 853.3 377.3 C 854.2 386.9 850.3 410.6 852.2 424.1 C 854.1 437.6 864 465.8 864.6 458.3 C 865.2 450.7 857.2 391.9 855.7 378.6"},
  {w: 20, d: "M 166.5 623.5 C 163.8 619.8 152.7 612.9 150.1 601.5 C 147.6 590 153 571.2 151.4 554.9 C 149.9 538.7 141.8 514.3 140.8 503.7 C 139.7 493.1 142.4 493.6 145.1 491.5 C 147.7 489.3 152.2 488.8 156.7 490.8 C 161.2 492.9 168 498.4 172.1 503.7 C 176.1 508.9 178.5 509.3 181 522.4 C 183.4 535.5 186.6 568.7 187 582.1 C 187.3 595.5 185 597.9 183 602.6 C 181.1 607.2 177.6 610.6 175.2 610 C 172.9 609.4 169.7 608.7 168.9 599.1 C 168 589.5 171.9 565.8 170 552.3 C 168.1 538.8 158.2 510.5 157.6 518.1 C 157 525.7 165 584.5 166.5 597.8"},
  {w: 20, d: "M 727.1 405.7 C 724.6 409.3 714.7 419 712.2 427.3 C 709.8 435.6 708.5 448.7 712.4 455.4 C 716.3 462.1 728.2 467.2 735.7 467.3 C 743.2 467.4 754.3 458.8 757.5 456 C 760.6 453.3 758.4 451.3 754.6 450.6 C 750.8 449.9 739.3 452.5 734.8 451.8 C 730.2 451 728.9 448.7 727.2 446 C 725.4 443.3 723.8 439.7 724.3 435.6 C 724.8 431.4 727.2 419.9 730.3 421.1 C 733.4 422.3 740.8 439.3 742.9 442.9"},
  {w: 20, d: "M 295.1 570.7 C 297.6 567.1 307.5 557.4 310 549.1 C 312.4 540.8 313.7 527.6 309.8 521 C 305.9 514.3 294 509.2 286.5 509.1 C 279 509 267.9 517.6 264.8 520.3 C 261.6 523.1 263.8 525 267.6 525.7 C 271.4 526.5 282.9 523.9 287.4 524.6 C 292 525.4 293.3 527.6 295.1 530.3 C 296.8 533 298.4 536.7 297.9 540.8 C 297.4 545 295 556.5 291.9 555.3 C 288.8 554 281.4 537.1 279.3 533.5"},
  {w: 20, d: "M 772.9 487.1 C 773.3 489.7 776.3 498.5 775.6 502.5 C 774.8 506.6 772.9 511.5 768.6 511.4 C 764.3 511.4 750.8 505.1 749.8 502.1 C 748.9 499 759.3 493.7 762.9 493 C 766.5 492.4 776.4 496.8 771.4 498.1 C 766.4 499.4 741.4 499 732.9 500.8 C 724.3 502.7 719.1 504 720.2 509.2 C 721.2 514.4 735.4 517.3 738.9 531.9 C 742.4 546.5 742.8 586.3 741.3 596.8 C 739.7 607.4 734.3 597.8 729.5 595.1 C 724.7 592.3 713.6 587.7 712.5 580.3 C 711.5 573 722.6 560.4 723 551 C 723.4 541.5 715.1 521.3 715.1 523.8 C 715 526.4 720.4 558.2 722.7 566.2 C 725 574.2 727.9 572.9 729 571.7 C 730.2 570.6 731.3 566.2 729.7 559.4 C 728 552.5 723.4 538.8 719.2 530.8 C 715 522.8 706.8 514.6 704.3 511.4"},
  {w: 20, d: "M 249.3 489.3 C 248.9 486.7 245.9 477.9 246.7 473.8 C 247.4 469.8 249.4 464.9 253.7 464.9 C 257.9 465 271.4 471.2 272.4 474.3 C 273.3 477.4 263 482.7 259.4 483.4 C 255.8 484 245.8 479.6 250.8 478.3 C 255.8 477 280.8 477.4 289.4 475.6 C 297.9 473.7 303.1 472.4 302.1 467.2 C 301.1 462 286.8 459.1 283.3 444.5 C 279.8 429.9 279.4 390.1 281 379.6 C 282.5 369 287.9 378.5 292.7 381.3 C 297.5 384 308.6 388.7 309.7 396.1 C 310.8 403.4 299.6 416 299.2 425.4 C 298.8 434.8 307.1 455.1 307.1 452.6 C 307.2 450 301.9 418.2 299.5 410.2 C 297.2 402.2 294.3 403.5 293.2 404.6 C 292 405.8 290.9 410.2 292.5 417 C 294.2 423.8 298.8 437.6 303 445.6 C 307.2 453.6 315.4 461.8 317.9 465"},
  {w: 20, d: "M 660 532.9 C 661 537.7 667.6 555.8 666.2 561.8 C 664.8 567.8 660.6 572 651.4 568.9 C 642.2 565.8 620.1 550.8 611.1 543.2 C 602.1 535.6 599.8 528.7 597.3 523.2 C 594.8 517.7 594.7 512 596 510.2 C 597.4 508.3 598.4 506.4 605.4 512.1 C 612.4 517.7 629.7 537.9 638.1 544 C 646.5 550.1 652.8 547.8 655.7 548.6"},
  {w: 20, d: "M 362.2 443.5 C 361.2 438.7 354.6 420.6 356 414.6 C 357.4 408.6 361.6 404.4 370.8 407.5 C 380 410.6 402.1 425.6 411.1 433.2 C 420.1 440.8 422.4 447.7 424.9 453.2 C 427.4 458.7 427.5 464.4 426.2 466.2 C 424.8 468.1 423.8 470 416.8 464.3 C 409.8 458.7 392.5 438.5 384.1 432.4 C 375.7 426.3 369.5 428.6 366.5 427.8"},
  {w: 20, d: "M 787.1 550 C 791.1 556.6 805.9 574.5 811.3 589.4 C 816.7 604.2 820.5 639.1 819.4 639 C 818.3 639 804.4 595.5 804.6 588.9 C 804.9 582.2 816.9 592.8 820.9 599.2 C 824.9 605.6 827.3 622.5 828.6 627.1"},
  {w: 20, d: "M 235.1 426.4 C 231.1 419.8 216.3 401.9 210.9 387 C 205.6 372.2 201.7 337.3 202.8 337.3 C 204 337.4 217.9 380.9 217.6 387.5 C 217.3 394.1 205.3 383.5 201.3 377.2 C 197.3 370.8 194.9 353.9 193.6 349.3"},
  {w: 20, d: "M 828.6 504.3 C 828.9 508.1 825.4 517.9 830.3 526.8 C 835.3 535.8 853.3 544.1 858.4 557.9 C 863.5 571.7 860.2 602.2 860.8 609.5 C 861.5 616.9 861 602.7 862.4 602.1 C 863.8 601.5 867 606.9 869.1 605.9 C 871.1 604.8 873.5 603.6 874.4 595.7 C 875.4 587.8 879.7 570 874.6 558.4 C 869.6 546.8 846.3 528.9 844.1 526.2 C 842 523.5 856.9 535.1 861.7 542.1 C 866.6 549 870.8 559.3 873.3 567.8 C 875.9 576.2 877.8 586.8 877 592.7 C 876.2 598.6 870 601.2 868.6 602.9"},
  {w: 20, d: "M 193.6 472.1 C 193.3 468.3 196.9 458.5 191.9 449.6 C 186.9 440.6 168.9 432.2 163.8 418.4 C 158.7 404.7 162.1 374.2 161.4 366.8 C 160.7 359.5 161.2 373.7 159.8 374.3 C 158.5 374.9 155.2 369.4 153.2 370.5 C 151.2 371.6 148.7 372.7 147.8 380.7 C 146.8 388.6 142.6 406.4 147.6 418 C 152.7 429.6 176 447.5 178.1 450.2 C 180.2 452.9 165.3 441.2 160.5 434.3 C 155.6 427.4 151.4 417.1 148.9 408.6 C 146.3 400.2 144.4 389.5 145.2 383.7 C 146 377.8 152.2 375.2 153.6 373.5"},
  {w: 20, d: "M 852.9 655.7 C 855.6 657.6 864.9 662.4 869 667.1 C 873.1 671.9 877.2 673.8 877.5 684.4 C 877.8 695.1 873.1 720.7 870.8 730.8 C 868.5 740.9 866.8 741.4 863.5 744.8 C 860.2 748.2 855.6 750.7 851.1 751.1 C 846.6 751.5 840.2 749.8 836.5 747.1 C 832.8 744.5 829.4 740.4 828.7 735.2 C 828 730.1 828.2 725.4 832.4 716.3 C 836.6 707.2 849 686.5 853.8 680.6 C 858.7 674.8 859.8 679.5 861.6 681.3 C 863.4 683.1 865.4 685.2 864.6 691.4 C 863.8 697.7 860.5 712.3 857 718.6 C 853.5 724.9 843.6 735.9 843.6 729.2 C 843.7 722.5 854.9 687 857.1 678.6"},
  {w: 20, d: "M 169.3 320.7 C 166.6 318.8 157.3 314 153.2 309.2 C 149.1 304.4 145 302.5 144.7 291.9 C 144.4 281.3 149.1 255.6 151.4 245.6 C 153.8 235.5 155.4 235 158.7 231.6 C 162 228.2 166.6 225.7 171.1 225.3 C 175.6 224.9 182 226.6 185.7 229.2 C 189.5 231.9 192.8 236 193.5 241.1 C 194.2 246.3 194 250.9 189.9 260 C 185.7 269.1 173.3 289.9 168.4 295.7 C 163.5 301.6 162.4 296.9 160.6 295.1 C 158.8 293.3 156.8 291.2 157.6 284.9 C 158.4 278.7 161.7 264.1 165.2 257.8 C 168.7 251.5 178.6 240.5 178.6 247.2 C 178.6 253.8 167.4 289.3 165.1 297.8"},
  {w: 20, d: "M 517.1 555.7 C 519 560.1 524 575.9 528.7 581.9 C 533.5 587.9 541.4 590.3 545.7 591.7 C 550 593.1 559.4 595.8 554.6 590.3 C 549.8 584.8 523.4 563.9 517.1 558.6"},
  {w: 20, d: "M 505.1 420.7 C 503.2 416.3 498.3 400.5 493.5 394.5 C 488.7 388.5 480.8 386 476.5 384.6 C 472.2 383.2 462.9 380.5 467.6 386.1 C 472.4 391.6 498.9 412.5 505.1 417.8"},
  {w: 20, d: "M 482.9 571.4 C 476.2 580 444.7 610.6 442.5 622.7 C 440.4 634.9 459.3 641.1 470 644.3 C 480.7 647.5 499.3 644.7 506.5 642.1 C 513.7 639.4 515 636.1 513 628.4 C 511 620.7 497.7 600 494.4 595.9 C 491.2 591.7 488.9 597.6 493.3 603.3 C 497.7 609 524.5 626.4 520.8 630 C 517.1 633.6 479.5 626.7 471.4 624.8 C 463.4 622.9 470.9 619.8 472.4 618.6 C 473.9 617.4 480 618.8 480.3 617.6 C 480.6 616.5 473.9 614.2 474.3 611.8 C 474.7 609.3 481.5 604.4 482.9 602.9"},
  {w: 20, d: "M 539.3 405 C 546 396.4 577.5 365.8 579.7 353.7 C 581.8 341.5 562.9 335.3 552.2 332.1 C 541.6 328.9 522.9 331.7 515.7 334.3 C 508.5 337 507.2 340.3 509.2 348 C 511.2 355.7 524.5 376.3 527.8 380.5 C 531.1 384.7 533.3 378.7 528.9 373 C 524.5 367.4 497.8 350 501.4 346.4 C 505.1 342.8 542.7 349.7 550.8 351.6 C 558.9 353.5 551.3 356.6 549.8 357.8 C 548.4 359 542.2 357.6 541.9 358.8 C 541.6 359.9 548.3 362.2 547.9 364.6 C 547.5 367.1 540.8 372 539.3 373.5"},
  {w: 20, d: "M 412.9 651.4 C 404.6 661.3 369.7 697.2 363.2 710.8 C 356.7 724.4 368.7 729.5 373.8 733 C 378.9 736.6 386.7 742.2 394 732.2 C 401.2 722.2 416.9 675.9 417.3 673 C 417.7 670.1 401.6 707.3 396.5 714.9 C 391.4 722.6 388.8 719.8 386.7 718.9 C 384.6 718 380.3 717.8 384 709.7 C 387.6 701.5 404.5 676.6 408.6 670"},
  {w: 20, d: "M 609.3 325 C 617.6 315.1 652.5 279.2 659 265.6 C 665.6 252 653.5 246.9 648.4 243.4 C 643.3 239.8 635.5 234.2 628.2 244.2 C 621 254.2 605.3 300.5 604.9 303.4 C 604.5 306.3 620.6 269.1 625.7 261.5 C 630.8 253.8 633.5 256.6 635.6 257.5 C 637.6 258.4 641.9 258.5 638.3 266.7 C 634.6 274.8 617.7 299.8 613.6 306.4"},
  {w: 20, d: "M 420 754.3 C 416.1 758.2 401.6 771.4 396.8 777.8 C 392 784.1 390.5 779.3 391.1 792.5 C 391.7 805.7 397.6 844.8 400.5 856.8 C 403.4 868.8 406 864.9 408.6 864.6 C 411.2 864.3 414.4 862.6 416 854.9 C 417.7 847.3 415.5 829.3 418.4 818.7 C 421.3 808.2 431.2 797.7 433.7 791.4 C 436.1 785.2 435.3 783.9 433.3 781.1 C 431.4 778.3 425.7 774.8 422.1 774.4 C 418.4 774.1 414.1 774.9 411.4 779.2 C 408.8 783.5 407.4 797.6 406.2 800.2 C 405 802.7 404 796.6 404.1 794.6 C 404.3 792.6 405.6 788.4 407 787.9 C 408.4 787.5 411.5 789.2 412.5 791.7 C 413.5 794.3 412.7 806.1 413 803.2 C 413.3 800.3 412.7 779.9 414.1 774.3 C 415.5 768.6 419.7 768.5 421.4 769.2 C 423.1 769.9 426.3 769.9 424.1 778.6 C 422 787.3 411.2 814.3 408.6 821.4"},
  {w: 20, d: "M 602.2 222.1 C 606.1 218.2 620.6 205 625.4 198.6 C 630.2 192.2 631.7 197 631.1 183.9 C 630.5 170.7 624.7 131.6 621.7 119.6 C 618.8 107.5 616.2 111.5 613.7 111.8 C 611.1 112.1 607.8 113.8 606.2 121.5 C 604.5 129.1 606.8 147.1 603.8 157.6 C 600.9 168.2 591.1 178.7 588.6 184.9 C 586.1 191.2 587 192.4 588.9 195.3 C 590.8 198.1 596.5 201.6 600.2 201.9 C 603.8 202.3 608.1 201.5 610.8 197.2 C 613.4 192.9 614.8 178.8 616 176.2 C 617.2 173.6 618.2 179.7 618.1 181.8 C 618 183.8 616.6 188 615.2 188.4 C 613.8 188.9 610.7 187.2 609.7 184.6 C 608.7 182.1 609.5 170.3 609.2 173.2 C 609 176.1 609.5 196.4 608.1 202.1 C 606.7 207.8 602.5 207.9 600.8 207.2 C 599.1 206.5 596 206.5 598.1 197.8 C 600.2 189.1 611 162.1 613.6 155"},
  {w: 20, d: "M 497.1 815.7 C 491.6 819 470.5 830.8 464.3 835.7 C 458.1 840.6 459.7 841.7 459.8 845.4 C 459.9 849.1 458.9 853.2 464.9 858.1 C 470.9 863 485.8 872.4 495.9 874.8 C 505.9 877.1 518.9 874.1 525.2 872.1 C 531.6 870.1 535.3 869.7 533.8 862.9 C 532.3 856 521.5 836.1 516.4 830.9 C 511.2 825.7 504.9 827.3 502.7 831.6 C 500.5 835.8 505 852.9 503 856.4 C 501.1 859.8 491.4 853.9 491 852.1 C 490.5 850.3 498.2 845.8 500.3 845.4 C 502.4 845 503.9 848.1 503.5 849.5 C 503.1 851 500.7 853.8 497.9 854 C 495.2 854.1 488.9 852.4 487.2 850.6 C 485.5 848.9 486.2 844.8 487.6 843.5 C 489.1 842.2 494.4 843 495.7 842.9"},
  {w: 20, d: "M 525.1 160.7 C 530.6 157.3 551.7 145.6 557.9 140.7 C 564.2 135.7 562.5 134.7 562.4 131 C 562.3 127.3 563.3 123.2 557.3 118.3 C 551.3 113.4 536.4 104 526.3 101.6 C 516.3 99.3 503.3 102.3 497 104.3 C 490.7 106.3 486.9 106.7 488.4 113.5 C 489.9 120.4 500.7 140.2 505.9 145.4 C 511.1 150.7 517.3 149.1 519.5 144.8 C 521.8 140.6 517.3 123.4 519.2 120 C 521.2 116.6 530.8 122.5 531.3 124.3 C 531.7 126.1 524 130.5 521.9 131 C 519.8 131.4 518.3 128.3 518.7 126.8 C 519.1 125.4 521.6 122.6 524.3 122.4 C 527 122.2 533.3 124 535.1 125.8 C 536.8 127.5 536 131.6 534.6 132.9 C 533.2 134.2 527.9 133.4 526.5 133.5"},
  {w: 20, d: "M 455.7 680 C 455.5 687.6 449.9 710.8 454.6 725.6 C 459.3 740.4 477.8 761.6 484 768.9 C 490.1 776.2 490.9 771.7 491.4 769.2 C 491.9 766.7 492.4 762.8 487.1 754 C 481.8 745.2 464.2 726.5 459.7 716.4 C 455.2 706.2 459.9 696.8 460 692.9"},
  {w: 20, d: "M 566.5 296.4 C 566.7 288.8 572.3 265.6 567.6 250.8 C 562.9 236 544.4 214.8 538.3 207.5 C 532.1 200.2 531.3 204.7 530.8 207.2 C 530.3 209.7 529.8 213.6 535.1 222.4 C 540.4 231.2 558 249.8 562.5 260 C 567.1 270.2 562.3 279.6 562.2 283.5"},
  {w: 20, d: "M 507.1 681.4 C 507.1 684.1 506 693.6 507.3 697.8 C 508.6 702 508.9 708.9 515.1 706.5 C 521.2 704.1 533.3 686.4 544.1 683.3 C 554.9 680.3 572.3 683.4 580 688.3 C 587.7 693.2 589.8 706.2 590.6 712.7 C 591.4 719.2 587.8 723.6 584.8 727.3 C 581.7 731 575.8 734.5 572.5 735.1 C 569.3 735.6 565.2 735.2 565.4 730.6 C 565.6 726.1 573.6 713.4 573.8 707.6 C 574.1 701.9 571.9 699 567 696 C 562.1 693.1 553.3 689.1 544.3 690 C 535.3 691 519.1 701.1 513 701.7 C 506.9 702.4 508.1 696.9 507.8 694 C 507.4 691 508.5 686.7 511.1 684 C 513.7 681.2 514.7 679.1 523.3 677.3 C 532 675.5 554.7 673 563 673 C 571.3 673.1 570.4 672.6 573.3 677.6 C 576.2 682.6 581.6 693.6 580.3 702.9 C 579 712.1 568.1 727.9 565.7 732.9"},
  {w: 20, d: "M 515.1 295 C 515.1 292.3 516.2 282.8 514.9 278.6 C 513.6 274.4 513.3 267.5 507.1 269.9 C 501 272.3 488.9 290 478.1 293.1 C 467.3 296.1 450 293 442.2 288.1 C 434.5 283.2 432.4 270.2 431.6 263.7 C 430.8 257.2 434.5 252.8 437.5 249.1 C 440.5 245.4 446.4 241.9 449.7 241.3 C 452.9 240.7 457 241.2 456.8 245.7 C 456.6 250.3 448.7 263 448.4 268.8 C 448.1 274.5 450.3 277.4 455.2 280.3 C 460.2 283.3 468.9 287.3 477.9 286.4 C 486.9 285.4 503.1 275.3 509.2 274.6 C 515.3 274 514.1 279.5 514.5 282.4 C 514.8 285.4 513.7 289.6 511.1 292.4 C 508.5 295.2 507.5 297.3 498.9 299.1 C 490.2 300.9 467.5 303.4 459.2 303.4 C 450.9 303.3 451.8 303.7 448.9 298.8 C 446 293.8 440.6 282.7 441.9 273.5 C 443.2 264.3 454.1 248.5 456.5 243.5"},
  {w: 20, d: "M 548.6 774.3 C 548.3 779.3 544.9 797.5 546.8 804.4 C 548.8 811.3 554.8 814.2 560.5 815.7 C 566.1 817.2 569.2 817.8 580.6 813.3 C 592.1 808.9 614.6 791.8 629.4 789.1 C 644.2 786.3 670.2 795.4 669.4 796.7 C 668.5 798 626 797.8 624.3 796.7 C 622.6 795.6 662.1 795.2 659 790 C 656 784.8 619.9 765.5 606 765.6 C 592.2 765.7 583.5 786 575.9 790.6 C 568.2 795.3 561.5 794.7 560.2 793.5 C 558.8 792.3 559.9 788.3 567.6 783.7 C 575.3 779.1 599 767.5 606.5 765.9 C 614 764.2 614.4 769.1 612.5 773.8 C 610.7 778.5 588.5 791.4 595.2 794.3 C 602 797.2 643.3 791.9 652.9 791.4"},
  {w: 20, d: "M 473.6 202.1 C 473.9 197.1 477.4 178.8 475.4 171.9 C 473.4 165 467.4 162.2 461.7 160.7 C 456.1 159.2 453.1 158.6 441.6 163 C 430.1 167.5 407.6 184.6 392.8 187.3 C 378.1 190.1 352 181 352.9 179.7 C 353.7 178.4 396.2 178.6 397.9 179.7 C 399.6 180.8 360.1 181.2 363.2 186.4 C 366.2 191.6 402.3 210.9 416.2 210.8 C 430 210.7 438.7 190.4 446.4 185.7 C 454 181.1 460.7 181.7 462.1 182.9 C 463.4 184.1 462.3 188.1 454.6 192.7 C 446.9 197.3 423.2 208.9 415.7 210.5 C 408.2 212.2 407.8 207.3 409.7 202.6 C 411.6 197.8 433.7 185 427 182.1 C 420.2 179.1 378.9 184.5 369.3 185"},
  {w: 20, d: "M 584.3 841.4 C 583.3 843.1 579.2 847.9 578.6 851.6 C 578 855.3 577.5 860.1 580.6 863.7 C 583.8 867.2 592.1 872.2 597.3 873 C 602.5 873.9 610.5 873.2 612.1 868.7 C 613.6 864.3 610.2 849.7 606.5 846.3 C 602.8 843 592.8 848.2 590 848.6"},
  {w: 20, d: "M 437.9 135 C 438.9 133.3 443 128.5 443.7 124.8 C 444.3 121.1 444.7 116.3 441.6 112.7 C 438.5 109.2 430.2 104.2 424.9 103.4 C 419.7 102.5 411.7 103.2 410.2 107.7 C 408.6 112.1 412 126.7 415.7 130 C 419.4 133.4 429.5 128.2 432.2 127.8"},
  {w: 20, d: "M 668.6 830 C 668 831.9 665 837.6 665.2 841.4 C 665.5 845.3 666.4 850 670.2 853 C 673.9 856 681.4 859.4 687.8 859.5 C 694.2 859.6 705.7 856.4 708.7 853.6 C 711.8 850.9 710.3 845.9 706 843 C 701.8 840.1 688 836.9 683.2 836.4 C 678.3 835.8 674.7 836.5 676.8 839.5 C 678.9 842.5 692.6 851.8 695.7 854.3"},
  {w: 20, d: "M 353.6 146.4 C 354.2 144.5 357.2 138.8 357 135 C 356.7 131.1 355.8 126.4 352.1 123.4 C 348.3 120.4 340.9 117 334.4 116.9 C 328 116.8 316.5 120 313.5 122.7 C 310.4 125.5 311.9 130.5 316.2 133.4 C 320.5 136.3 334.2 139.4 339.1 140 C 343.9 140.6 347.5 139.8 345.4 136.8 C 343.3 133.9 329.7 124.5 326.5 122.1"},
  {w: 20, d: "M 601.4 610 C 601.8 614 599.9 629.6 603.8 634 C 607.8 638.3 619 633 625.1 636.2 C 631.2 639.3 638.1 648.4 640.5 652.9 C 642.8 657.3 642 661.1 639.2 662.7 C 636.4 664.3 625.6 658.5 623.7 662.5 C 621.7 666.6 625.4 679.2 627.6 687.1 C 629.8 695.1 632.3 702.7 637 710.3 C 641.7 718 649.3 726.8 655.7 733 C 662.1 739.2 668.7 744.7 675.4 747.6 C 682.1 750.6 688.4 751.5 695.7 750.8 C 703 750.1 714.1 747.2 719.1 743.5 C 724 739.7 727.3 734.4 725.6 728.3 C 723.8 722.1 715.6 707.3 708.6 706.8 C 701.5 706.4 684.5 722.1 683.2 725.6 C 681.9 729 700.9 727.2 700.8 727.3 C 700.8 727.3 686.5 727 682.9 725.9 C 679.2 724.7 678.7 722.9 679 720.3 C 679.4 717.8 687.9 713 684.8 710.5 C 681.7 708 666.6 707.9 660.5 705.6 C 654.4 703.2 650.6 702.9 648.3 696.5 C 645.9 690.1 642.8 666.5 646.4 667.1 C 650 667.8 661.6 692.5 669.9 700.2 C 678.1 707.8 691.4 710.8 695.7 712.9"},
  {w: 20, d: "M 420.8 366.4 C 420.4 362.4 422.3 346.8 418.4 342.4 C 414.4 338 403.2 343.3 397.1 340.2 C 391 337 384.1 327.9 381.7 323.5 C 379.4 319.1 380.2 315.3 383 313.7 C 385.8 312.1 396.6 317.9 398.6 313.8 C 400.5 309.8 396.8 297.2 394.6 289.2 C 392.4 281.3 389.9 273.7 385.2 266.1 C 380.6 258.4 372.9 249.6 366.5 243.4 C 360.1 237.1 353.5 231.7 346.8 228.8 C 340.2 225.8 333.8 224.9 326.5 225.6 C 319.2 226.3 308.1 229.1 303.2 232.9 C 298.2 236.6 294.9 242 296.7 248.1 C 298.4 254.2 306.6 269.1 313.6 269.5 C 320.7 270 337.8 254.2 339.1 250.8 C 340.3 247.4 321.4 249.1 321.4 249.1 C 321.5 249 335.7 249.4 339.4 250.5 C 343 251.7 343.5 253.5 343.2 256.1 C 342.9 258.6 334.4 263.4 337.5 265.9 C 340.6 268.3 355.7 268.5 361.7 270.8 C 367.8 273.2 371.6 273.5 374 279.9 C 376.3 286.3 379.4 309.8 375.8 309.2 C 372.2 308.6 360.6 283.9 352.4 276.2 C 344.1 268.6 330.8 265.6 326.5 263.5"},
  {w: 20, d: "M 752.9 765.7 C 751.4 770.5 744.5 786.7 743.8 794.3 C 743.1 801.9 743.7 804.1 748.7 811.4 C 753.8 818.8 768.3 834.7 774.3 838.4 C 780.2 842.1 782.3 836.5 784.4 833.5 C 786.6 830.5 791.5 827.9 787.1 820.5 C 782.8 813.1 763.4 797 758.4 789 C 753.4 781.1 754.5 769.1 757.2 773 C 759.9 776.9 772.7 804.9 774.6 812.5 C 776.5 820.1 771.2 821.2 768.7 818.6 C 766.3 816 761.5 800.7 760 797.1"},
  {w: 20, d: "M 269.3 210.7 C 270.8 205.9 277.7 189.7 278.4 182.1 C 279.1 174.5 278.6 172.3 273.5 164.9 C 268.4 157.6 253.9 141.6 247.9 138 C 242 134.3 239.9 139.9 237.8 142.9 C 235.6 145.9 230.7 148.5 235.1 155.9 C 239.4 163.3 258.8 179.4 263.8 187.3 C 268.8 195.2 267.7 207.3 265.1 203.4 C 262.4 199.4 249.5 171.4 247.6 163.8 C 245.7 156.3 251.1 155.2 253.5 157.8 C 255.9 160.4 260.8 175.7 262.2 179.3"}
];

/* ---- turrets, inhibitors and nexuses ----

   ALL THIRTY MEASURED. Both sides were clicked by hand on the platform
   squares drawn into the terrain -- the buildings themselves. Nothing here
   is mirrored, so no centre has to be right for these to be right.

   THE ROTATION SWAPS TOP AND BOTTOM. This is what the red side had wrong.
   Rotating the map 180 degrees carries the top lane onto the BOTTOM lane --
   the path that runs up the left edge and across the top becomes the one
   down the right edge and across the bottom. So the partner of blue-top-t1
   is red-BOT-t1. The red keys used to be generated by replacing "blue-"
   with "red-" and keeping the lane, which put every top and bottom structure
   on the wrong side of the map: pairing them that way leaves a median
   absolute deviation of (60.0, 65.4)px, while pairing with the swap leaves
   (1.2, 2.4)px. Mid structures and the nexus map to themselves, which is
   why only those four of fifteen looked right and the error passed as
   "slightly off" rather than as a wrong lane.

   MAP_LANES had this right all along -- bot is generated as the rotation of
   top. Only the structure keys did not.

   Tiers run outward from your own nexus: t1 is the outer turret, t3 guards
   the inhibitor. */
const MAP_STRUCTURES = [
  {key: "blue-top-t1", side: "blue", kind: "turret", fx: 0.11111, fy: 0.26528},
  {key: "blue-top-t2", side: "blue", kind: "turret", fx: 0.11944, fy: 0.51806},
  {key: "blue-top-t3", side: "blue", kind: "turret", fx: 0.11806, fy: 0.68194},
  {key: "blue-top-inhib", side: "blue", kind: "inhibitor", fx: 0.12361, fy: 0.74583},
  {key: "blue-mid-t1", side: "blue", kind: "turret", fx: 0.43056, fy: 0.55417},
  {key: "blue-mid-t2", side: "blue", kind: "turret", fx: 0.3625, fy: 0.65139},
  {key: "blue-mid-t3", side: "blue", kind: "turret", fx: 0.28889, fy: 0.73472},
  {key: "blue-mid-inhib", side: "blue", kind: "inhibitor", fx: 0.24583, fy: 0.76944},
  {key: "blue-bot-t1", side: "blue", kind: "turret", fx: 0.73056, fy: 0.90139},
  {key: "blue-bot-t2", side: "blue", kind: "turret", fx: 0.4875, fy: 0.90417},
  {key: "blue-bot-t3", side: "blue", kind: "turret", fx: 0.31528, fy: 0.92361},
  {key: "blue-bot-inhib", side: "blue", kind: "inhibitor", fx: 0.2625, fy: 0.90417},
  {key: "blue-nexus-t1", side: "blue", kind: "turret", fx: 0.14306, fy: 0.82361},
  {key: "blue-nexus-t2", side: "blue", kind: "turret", fx: 0.19306, fy: 0.86528},
  {key: "blue-nexus", side: "blue", kind: "nexus", fx: 0.14444, fy: 0.875},
  {key: "red-top-t1", side: "red", kind: "turret", fx: 0.29167, fy: 0.07222},
  {key: "red-top-t2", side: "red", kind: "turret", fx: 0.53472, fy: 0.08056},
  {key: "red-top-t3", side: "red", kind: "turret", fx: 0.68611, fy: 0.08056},
  {key: "red-top-inhib", side: "red", kind: "inhibitor", fx: 0.75833, fy: 0.06944},
  {key: "red-mid-t1", side: "red", kind: "turret", fx: 0.59722, fy: 0.42083},
  {key: "red-mid-t2", side: "red", kind: "turret", fx: 0.65972, fy: 0.32778},
  {key: "red-mid-t3", side: "red", kind: "turret", fx: 0.73611, fy: 0.25972},
  {key: "red-mid-inhib", side: "red", kind: "inhibitor", fx: 0.77917, fy: 0.20139},
  {key: "red-bot-t1", side: "red", kind: "turret", fx: 0.91389, fy: 0.71806},
  {key: "red-bot-t2", side: "red", kind: "turret", fx: 0.9, fy: 0.45833},
  {key: "red-bot-t3", side: "red", kind: "turret", fx: 0.90833, fy: 0.30556},
  {key: "red-bot-inhib", side: "red", kind: "inhibitor", fx: 0.90417, fy: 0.22361},
  {key: "red-nexus-t1", side: "red", kind: "turret", fx: 0.87639, fy: 0.15},
  {key: "red-nexus-t2", side: "red", kind: "turret", fx: 0.82778, fy: 0.10833},
  {key: "red-nexus", side: "red", kind: "nexus", fx: 0.87222, fy: 0.10833}
].map(s => ({...s, x: s.fx * MAP_SIZE, y: s.fy * MAP_SIZE}));

/* Every place a plan can refer to by name, in one list — camps and pits
   together, because an author placing a route step does not care which
   kind of thing they are clicking. */
function mapPlaces(){
  const tidy = k => k.replace(/-/g, " ").replace(/\bt(\d)\b/, "T$1")
    .replace(/\binhib\b/, "inhibitor").replace(/^./, c => c.toUpperCase());
  return MAP_CAMPS.map(c => ({key: c.key, x: c.x, y: c.y, name: c.name, short: c.short}))
    .concat(MAP_PITS.map(p => ({key: p.key, x: p.x, y: p.y, name: p.name, short: p.name})))
    .concat(MAP_STRUCTURES.map(t => ({key: t.key, x: t.x, y: t.y, name: tidy(t.key), short: ""})));
}

/* The nearest named place to a point, or null when nothing is close enough.
   Used by the editor so a route step lands ON the red buff rather than
   somewhere near it, and so the stored plan can say so. */
function mapNearest(x, y, within){
  const limit = within == null ? 44 : within;
  let best = null, bestD = Infinity;
  for(const p of mapPlaces()){
    const d = Math.hypot(p.x - x, p.y - y);
    if(d < bestD){ bestD = d; best = p; }
  }
  return (best && bestD <= limit) ? best : null;
}

/* ---- the drawing ----
   Terrain ONLY — ground, bases, lanes, river, walls. Camps and pits belong
   to mapOverlaySvg, which sits above whichever backdrop is in use. They
   used to be drawn here too, which put two of every camp on the schematic:
   one from the terrain, one from the overlay.

   One <svg> of terrain and nothing interactive. Plans are drawn into a
   separate layer on top by whoever renders them, so this never has to know
   what a route is.

   Every corridor is painted TWICE: a wider darker pass for the edge, then
   the fill on top. That is what gives rock and road a rim instead of a flat
   silhouette, and it costs one extra path per shape.

   Each pass is a GROUP at partial opacity rather than paths at partial
   opacity. Forty-two overlapping half-transparent rocks darken wherever two
   meet, and the seams are the first thing the eye finds.

   NO TURRETS. There is no measured position for one, and putting remembered
   coordinates back on the page is the exact mistake the painting pass was
   done to undo. They are a short click pass away when they are wanted. */

/* Gradients need ids, and a page showing two maps would otherwise have two
   elements answering to the same one — the second map would silently borrow
   the first one's fills. */
let MAP_UID = 0;

function mapTerrainSvg(){
  const u = "m" + (++MAP_UID);
  /* grow is how much wider the edge pass runs than the fill */
  const band = (cls, list, grow) => list.map(s =>
    `<path class="${cls}" d="${s.d}" stroke-width="${s.w + grow}"/>`).join("");

  return `<svg class="m-svg" viewBox="0 0 ${MAP_SIZE} ${MAP_SIZE}"
     xmlns="http://www.w3.org/2000/svg" role="img"
     aria-label="Season 3 Summoner's Rift, blue base bottom left">
    <defs>
      <clipPath id="${u}-clip"><rect x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" rx="16"/></clipPath>
      <radialGradient id="${u}-ground" cx="50%" cy="50%" r="72%">
        <stop offset="0%" stop-color="#d4bd92"/>
        <stop offset="100%" stop-color="#bda47a"/>
      </radialGradient>
      <linearGradient id="${u}-water" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#8fc4de"/>
        <stop offset="100%" stop-color="#6aa5cc"/>
      </linearGradient>
      <radialGradient id="${u}-blue" cx="18%" cy="88%" r="92%">
        <stop offset="0%" stop-color="#4b86c9"/><stop offset="100%" stop-color="#2f5f96"/>
      </radialGradient>
      <radialGradient id="${u}-red" cx="86%" cy="12%" r="92%">
        <stop offset="0%" stop-color="#cf6450"/><stop offset="100%" stop-color="#9e4334"/>
      </radialGradient>
      <radialGradient id="${u}-vig" cx="50%" cy="50%" r="50%">
        <stop offset="62%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#4a3a20" stop-opacity=".28"/>
      </radialGradient>
    </defs>

    <g clip-path="url(#${u}-clip)">
      <rect x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" fill="url(#${u}-ground)"/>

      <g class="m-bases">${MAP_BASES.map(b =>
        `<path class="m-base" d="${b.d}" fill="url(#${u}-${b.key})"/>`).join("")}</g>

      <g class="m-lane-edge">${band("m-band", MAP_LANES, 11)}</g>
      <g class="m-lane">${band("m-band", MAP_LANES, 0)}</g>

      <g class="m-river-edge">${band("m-band", MAP_RIVER, 10)}</g>
      <g class="m-river">${MAP_RIVER.map(s =>
        `<path class="m-band" d="${s.d}" stroke-width="${s.w}" stroke="url(#${u}-water)"/>`).join("")}</g>

      <g class="m-wall-edge">${band("m-band", MAP_WALLS, 7)}</g>
      <g class="m-wall">${band("m-band", MAP_WALLS, 0)}</g>

      <rect x="0" y="0" width="${MAP_SIZE}" height="${MAP_SIZE}" fill="url(#${u}-vig)" pointer-events="none"/>
    </g>
    <rect class="m-frame" x="2" y="2" width="${MAP_SIZE - 4}" height="${MAP_SIZE - 4}" rx="16"/>
  </svg>`;
}


/* ---- the game's own icons ----

   Hotlinked from Community Dragon, like every other Riot image on this site
   except the map plate. Two different sets, because they do two jobs:

   STRUCTURES use the mode's OWN minimap icons, from ux/minimap/icons/jade.
   These are literally the glyphs Riot's annotated plate was drawing, so the
   map ends up showing the same art the game does. "order" is blue, "chaos"
   is red -- the internal team names, which is why they read backwards.

   CAMPS use each monster's circular portrait. The jade minimap set only has
   generic junglecampbasic/mini icons, which would make every camp look the
   same; the portraits tell wolves from wraiths at a glance, which is the
   whole point of a jungle route being legible.

   The Season 3 monsters survive under an s3_ prefix, so these are the
   actual Ancient Golem and Lizard Elder rather than the modern Blue
   Sentinel and Red Brambleback redesigns. Wolves, golems and the great
   wraith kept their original names and need no prefix.

   EVERY ICON FAILS SOFT. The shape and letter are drawn first and the image
   goes over the top, so a path that rots later leaves the old marker behind
   rather than a hole. Nothing here is load-bearing. */
const MAP_ICON_GAME = "https://raw.communitydragon.org/latest/game/assets";
const MAP_ICON_MINIMAP = MAP_ICON_GAME + "/ux/minimap/icons/jade";

/* structure icons, by kind and side */
const MAP_STRUCT_ICON = {
  turret:     {blue: "towerorder.png",     red: "towerchaos.png"},
  inhibitor:  {blue: "inhibitororder.png", red: "inhibitorchaos.png"},
  nexus:      {blue: "nexusorder.png",     red: "nexuschaos.png"}
};
function mapStructIcon(t){
  const f = (MAP_STRUCT_ICON[t.kind] || {})[t.side];
  return f ? `${MAP_ICON_MINIMAP}/${f}` : "";
}

/* Camps use the mode's OWN minimap icons rather than monster portraits.

   The portraits told one camp from another at a glance, which was useful,
   but they are character art and never looked like part of a minimap. These
   four are what Classic actually draws, so the map matches the game.

   The cost is that they are generic: every ordinary camp gets the same
   glyph. That is how the game behaves -- a jungler reads camps by position,
   not by picture -- but this map exists to let a guide NAME places, so the
   short label is drawn over the icon instead of only standing in when an
   icon fails.

   basic is the BUFF glyph and mini the ordinary-camp one, which is the
   opposite of what the names suggest. Confirmed against an in-game
   screenshot: the two buff camps carry a distinct tan marker while every
   other camp is one of the small amber diamonds. Worth stating plainly,
   because "basic" reads like the default and picking it for everything
   would put buff markers on all twelve camps. */
const MAP_JUNGLE_ICON = {
  buff:        "junglecampbasic.png",   /* Ancient Golem — a buff */
  red:         "junglecampbasic.png",   /* Lizard Elder  — a buff */
  wraiths:     "junglecampmini.png",
  wolves:      "junglecampmini.png",
  golems:      "junglecampmini.png",
  greatwraith: "junglecampmini.png"
};
const MAP_PIT_ICON = {
  baron:  "junglecampbaron.png",
  dragon: "junglecampdragon.png"
};
function mapCampIcon(key){
  const f = MAP_JUNGLE_ICON[String(key).replace(/^(blue|red)-/, "")];
  return f ? `${MAP_ICON_MINIMAP}/${f}` : "";
}
function mapPitIcon(key){
  const f = MAP_PIT_ICON[key];
  return f ? `${MAP_ICON_MINIMAP}/${f}` : "";
}

/* ---- the markers, over whichever backdrop ----

   The backdrop is a SKIN, not the map. Camps and pits were measured as
   fractions of Riot's image, so the same marker layer sits correctly on the
   photo and on the schematic without a single number changing — which is the
   point of having measured fractions rather than drawn coordinates.

   mapFigure("photo") needs MAP_IMAGE to be reachable from this domain.
   mapFigure("schematic") needs nothing. Guides store neither: a plan refers
   to places by name, so switching the skin later cannot invalidate one. */
/* How big each icon draws, in the 0-1000 square. Kept here rather than in
   the stylesheet because the limit is geometric, not aesthetic: the two
   nexus turrets sit about 31 units apart, so a turret icon much wider than
   that stops reading as two buildings.

   Camps are one size rather than scaled per camp. Varying them by monster
   count was a nice idea that made the map look uneven next to structures
   that are all the same size, and the difference carried no information a
   reader could use. */
const MAP_ICON_R = {turret: 20, inhibitor: 25, nexus: 31, camp: 21, pit: 29};

function mapOverlaySvg(){
  const u = "o" + (++MAP_UID);
  /* A FEATHERED mask, not a hard clip. Clipping a portrait to a circle
     leaves a cut edge, and a cut edge is what makes a marker read as
     something stuck on top of the map. Fading the last quarter of the
     radius lets the monster art dissolve into the ground it stands on.
     SOLID is where the fade starts; anything drawn under the icon has to
     stay inside that or it shows through the soft part. */
  const SOLID = 0.74;
  const defs = `<defs>
    <radialGradient id="${u}-fade" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#fff"/>
      <stop offset="${SOLID}" stop-color="#fff"/>
      <stop offset="1" stop-color="#fff" stop-opacity="0"/>
    </radialGradient>
    <mask id="${u}-cc" maskContentUnits="objectBoundingBox">
      <rect x="0" y="0" width="1" height="1" fill="url(#${u}-fade)"/>
    </mask>
  </defs>`;
  /* onerror is what makes the "degrades to the disc" promise below TRUE. It
     was only ever a comment: the backing shape sits at opacity .001 and a
     failed icon left the browser's broken-image glyph sitting on top of it.
     Rendering the map with the icon host unreachable is what showed this --
     thirty torn-page glyphs. Dropping the image and lighting the shape back
     up turns an outage into a plain marker map. */
  const pic = (href, x, y, r, soft) => href
    ? `<image href="${href}" x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}"
         preserveAspectRatio="xMidYMid slice"${soft ? ` mask="url(#${u}-cc)"` : ""}
         loading="lazy"
         onerror="this.parentNode.setAttribute('data-noicon','1');this.remove()"/>`
    : "";

  /* Camps and pits are UI glyphs with their own silhouette and a
     transparent surround, exactly like the structures -- so no feather mask
     and no colour grading.

     NO LABELS. The glyphs are generic, so the map no longer says in writing
     which camp is which; position does that, as it does in the game. The
     disc beneath is all that is left of the fallback -- without a letter to
     carry, it is just a marker that something is there when an icon fails. */
  const camp = c => `<g class="m-camp" data-place="${c.key}">
      <circle cx="${c.x}" cy="${c.y}" r="${MAP_ICON_R.camp * 0.52}"></circle>
      ${pic(mapCampIcon(c.key), c.x, c.y, MAP_ICON_R.camp, false)}
    </g>`;
  const pit = p => `<g class="m-pit" data-place="${p.key}">
      <circle cx="${p.x}" cy="${p.y}" r="${MAP_ICON_R.pit * 0.52}"></circle>
      ${pic(mapPitIcon(p.key), p.x, p.y, MAP_ICON_R.pit, false)}
    </g>`;
  /* Structures keep a hard edge: their icons are UI glyphs with their own
     silhouette and transparent surround, so there is no rectangle to hide
     and feathering would only dim them. */
  const struct = t => {
    const r = MAP_ICON_R[t.kind] || 20;
    const b = t.kind === "turret" ? 9 : t.kind === "inhibitor" ? 11 : 15;
    const shape = t.kind === "turret"
      ? `<rect x="${t.x - b}" y="${t.y - b}" width="${b * 2}" height="${b * 2}" rx="2.5"/>`
      : `<path d="M ${t.x} ${t.y - b} L ${t.x + b} ${t.y} L ${t.x} ${t.y + b} L ${t.x - b} ${t.y} Z"/>`;
    return `<g class="m-struct ${t.side} ${t.kind}" data-place="${t.key}">${shape}
      ${pic(mapStructIcon(t), t.x, t.y, r, false)}</g>`;
  };
  return `<svg class="m-overlay" viewBox="0 0 ${MAP_SIZE} ${MAP_SIZE}"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    ${defs}
    ${MAP_STRUCTURES.map(struct).join("")}
    ${MAP_PITS.map(pit).join("")}
    ${MAP_CAMPS.map(camp).join("")}
  </svg>`;
}

/* The whole figure: a backdrop with the markers over it. A plan layer goes
   in after the overlay, in the same viewBox. */
function mapFigure(skin, planSvg){
  const back = skin !== "schematic"
    ? `<img class="m-photo" src="${MAP_IMAGE}" alt="Season 3 Summoner's Rift" loading="lazy">`
    : mapTerrainSvg();
  return `<div class="m-fig" data-skin="${skin === "schematic" ? "schematic" : "photo"}">
    ${back}${mapOverlaySvg()}${planSvg || ""}
  </div>`;
}

/* ---- drawing a plan over the map ----

   A plan is author data, so this function is the second place (after
   normaliseGuide) where a hostile value could reach the page. It does not
   trust its input: colours and marker kinds are looked up in tables rather
   than interpolated, unknown place keys are dropped rather than rendered as
   NaN coordinates, and the only author string that reaches the page is the
   route label, escaped.

   Routes are numbered. A jungle clear is an ORDER as much as a path, and a
   line alone cannot say which end it starts from. */
const PLAN_COLOUR_HEX = {
  gold:   "#e0a84a",
  blue:   "#4f93d8",
  red:    "#d8574a",
  green:  "#5fb87a",
  purple: "#9a7fd0"
};
/* Riot's own ward icons, RECOLOURED AND SELF-HOSTED.

   They could not be hotlinked as they ship. The filenames name the ward TYPE
   -- "green" is the trinket, "pink" the control ward, from the days those
   were the item colours -- while the pixels carry the TEAM colour, and both
   ally versions are blue. So the pair that reads as green-and-pink in the
   filename arrives as two blue icons, which is how they first looked here.

   tools/tint-wards.py recolours each one and writes the copy in art/. The
   silhouettes are Riot's and untouched -- a totem for the trinket, an eye
   for the control ward -- which is the part worth having; only the hue
   changes. Re-run that script to change a colour or refresh the source.

   This makes them the second and third mirrored Riot assets after the map
   plate. Unavoidable here: the edit IS the point, so there is nothing to
   link to. */
const MAP_WARD_ICON = {ward: "art/ward-green.png", pink: "art/ward-pink.png"};

/* A step is a named place or a raw point. Unknown names resolve to null and
   the caller drops them, which is what keeps a guide written against an
   older map from drawing a route through the top-left corner. */
function mapPoint(step){
  if(!step) return null;
  if(step.place){
    const p = mapPlaces().find(q => q.key === step.place);
    return p ? {x: p.x, y: p.y} : null;
  }
  if(Number.isFinite(step.x) && Number.isFinite(step.y))
    return {x: step.x * MAP_SIZE, y: step.y * MAP_SIZE};
  return null;
}

function mapPlanSvg(plan){
  if(!plan) return "";
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  const col = c => PLAN_COLOUR_HEX[c] || PLAN_COLOUR_HEX.gold;
  const u = "p" + (++MAP_UID);

  /* routes: a smooth line, then a numbered pip at every stop */
  /* The colour name is resolved to a KNOWN one first and that is what gets
     used everywhere after. Looking it up for the stroke while interpolating
     the raw value into the marker-end URL would leave the enum guarding one
     use and not the other -- which is exactly what this did until a test
     fed it a colour with a quote in it. */
  const safeCol = c => PLAN_COLOUR_HEX[c] ? c : "gold";
  /* ONE STOP STILL DRAWS. This used to return nothing below two points, so
     in the editor the first click of a path placed a stop and showed
     nothing -- the path only appeared on the second click, which read as
     the first one having missed. A single stop draws its pip and no line;
     there is simply no line to draw yet. (normaliseGuide still drops
     one-stop paths when a guide is published, which is right: a path with
     one stop is unfinished, not a path.) */
  /* ---- coincident glyphs ----
     Two things on one spot is not an edge case, it is how people plan: a
     route ends where the next begins, and a danger marker goes on the camp
     the route paths through. Rendering a published demo showed five exact
     collisions across five plans -- stop 3 vanished under a danger triangle
     and stop 5 under the next route's stop 1. The hidden one is always the
     one drawn first, so the sequence loses a number with nothing to show
     that it did.

     Items are slotted in DRAW ORDER, which gives route stops priority: the
     numbered pip keeps the camp it names and the annotation steps aside.
     The route LINE still joins the true points -- only the glyph moves, so
     the path a reader traces is unchanged. */
  /* 34 = a pip radius (15) plus a marker half-width (19), so a displaced
     glyph sits just clear of the one that kept the spot rather than lapping
     over its edge, which read as a mistake at 28. */
  const SPREAD_R = 34;
  const taken = new Map();
  /* 12 units ~ the glyph radii here, so this catches overlap rather than
     mere proximity; identical places collide exactly whatever the grid. */
  const slot = q => {
    const k = Math.round(q.x / 12) + ":" + Math.round(q.y / 12);
    const n = taken.get(k) || 0;
    taken.set(k, n + 1);
    return n;
  };
  /* ring out, starting up-right, so the first displaced glyph lands where
     a reader is least likely to have a route line already */
  const nudge = (q, n) => {
    if(!n) return q;
    const ring = Math.ceil(n / 4), a = (-40 + ((n - 1) % 4) * 90) * Math.PI / 180;
    return {x: q.x + Math.cos(a) * SPREAD_R * ring,
            y: q.y + Math.sin(a) * SPREAD_R * ring};
  };

  const routes = (plan.routes || []).map((r, ri) => {
    const pts = (r.steps || []).map(mapPoint).filter(Boolean);
    if(!pts.length) return "";
    const c = safeCol(r.colour);
    const pips = pts.map((p0, i) => {
      const p = nudge(p0, slot(p0));
      return `<g class="pl-pip">
        <circle cx="${p.x}" cy="${p.y}" r="15" fill="${col(c)}"/>
        <text x="${p.x}" y="${p.y + 6}">${i + 1}</text></g>`;
    }).join("");
    let line = "";
    if(pts.length > 1){
      const d = pts.map((p, i) => (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1)).join(" ");
      line = `<path class="pl-line-under" d="${d}"/>
        <path class="pl-line" d="${d}" stroke="${col(c)}"
              marker-end="url(#${u}-arrow-${c})"/>`;
    }
    return `<g class="pl-route" data-route="${ri}">${line}${pips}</g>`;
  }).join("");

  /* Marker sizes live here rather than in the stylesheet because an SVG
     shape is drawn from coordinates, not styled into one. */
  const MR = 19;
  const marks = (plan.markers || []).map(m => {
    const p0 = mapPoint(m);
    if(!p0) return "";
    const p = nudge(p0, slot(p0));
    /* Wards keep the game's own icons, which are already green for a normal
       ward and pink for a control ward -- so the colour coding is Riot's and
       matches what a player sees in game. */
    const icon = MAP_WARD_ICON[m.kind];
    if(icon)
      return `<image class="pl-mark" href="${icon}" x="${p.x - MR}" y="${p.y - MR}"
                width="${MR * 2}" height="${MR * 2}" preserveAspectRatio="xMidYMid meet"/>`;
    if(m.kind === "danger")
      return `<g class="pl-mark pl-danger"><path d="M ${p.x} ${p.y - MR - 2}
                L ${p.x + MR + 1} ${p.y + MR - 5} L ${p.x - MR - 1} ${p.y + MR - 5} Z"/>
                <text x="${p.x}" y="${p.y + MR - 8}">!</text></g>`;
    /* A flag, not a ring: a target you are heading for reads as a flag
       planted on it, and the two concentric circles it replaced were easy to
       mistake for a camp marker at this size. */
    if(m.kind === "objective")
      return `<g class="pl-mark pl-obj">
                <path class="pl-pole" d="M ${p.x - 8} ${p.y + MR} L ${p.x - 8} ${p.y - MR}"/>
                <path class="pl-flag" d="M ${p.x - 8} ${p.y - MR} L ${p.x + MR - 1} ${p.y - 7}
                      L ${p.x - 8} ${p.y + 3} Z"/></g>`;
    /* A LABEL, not a glyph. Freehand ink can show where something happens
       but never what it is, so the drawing needs words next to it -- which
       is the job the shove and freeze symbols were doing badly. Escaped: an
       author typed it. */
    if(m.kind === "text")
      /* An empty label is one just placed and not yet typed into. It draws
         nothing rather than an empty element, so the map never carries an
         invisible node and a check for "is anything drawn" means what it
         says. */
      return m.text ? `<text class="pl-text" x="${p.x}" y="${p.y + 6}">${esc(m.text)}</text>` : "";
    return `<g class="pl-mark pl-note"><circle cx="${p.x}" cy="${p.y}" r="12"/></g>`;
  }).join("");

  const ink = (plan.ink || []).map(k => {
    const pts = (k.pts || []);
    if(pts.length < 2) return "";
    const d = pts.map((q, i) => (i ? "L" : "M") + (q[0] * MAP_SIZE).toFixed(1)
                + " " + (q[1] * MAP_SIZE).toFixed(1)).join(" ");
    const w = Math.max(2, Math.min(40, Number(k.w) || 8));
    return `<path class="pl-ink" d="${d}" stroke="${col(safeCol(k.colour))}" stroke-width="${w}"/>`;
  }).join("");

  /* one arrowhead per colour actually used, so the defs stay small */
  const used = [...new Set((plan.routes || []).map(r => safeCol(r.colour)))];
  const defs = used.map(c =>
    `<marker id="${u}-arrow-${c}" viewBox="0 0 10 10" refX="8" refY="5"
       markerWidth="5" markerHeight="5" orient="auto-start-reverse">
       <path d="M 0 0 L 10 5 L 0 10 z" fill="${col(c)}"/></marker>`).join("");

  return `<svg class="m-plan" viewBox="0 0 ${MAP_SIZE} ${MAP_SIZE}"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>${defs}</defs>
    ${ink}${routes}${marks}
  </svg>`;
}

/* The legend a plan needs: which coloured line is which. Returns "" when
   there is nothing to say, so the caller can drop the whole strip. */
function mapPlanLegend(plan){
  const esc = s => String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = (plan && plan.routes || []).filter(r => r.label);
  if(!rows.length) return "";
  return `<ul class="m-legend">${rows.map(r =>
    `<li><i style="background:${PLAN_COLOUR_HEX[r.colour] || PLAN_COLOUR_HEX.gold}"></i>${esc(r.label)}</li>`
  ).join("")}</ul>`;
}
