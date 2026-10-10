// Mothership decks: layout, props, waves, and the alien chatter for each one.

export const LEVELS = [
  {
    id: 'pen',
    kicker: 'Deck 1',
    name: 'Holding Pen',
    w: 30, d: 22,
    theme: { floor: '#2b3354', seam: '#161b30', glow: '#38d4ff', wall: '#262d4a', strip: '#38d4ff', light: 0x6fe3ff, light2: 0x8d7dff, fog: 0x0a0f22 },
    props: 'pen',
    waves: [{ grunt: 3 }, { grunt: 5 }, { grunt: 4, shooter: 1 }],
    taunt: 'ALIEN PA: "Specimen loose in the Holding Pen. Zorblets, retrieve the cow!"',
    tutorial: true,
  },
  {
    id: 'lab',
    kicker: 'Deck 2',
    name: 'Specimen Lab',
    w: 32, d: 24,
    theme: { floor: '#2d2a4f', seam: '#17142e', glow: '#ff5fd8', wall: '#2c2448', strip: '#ff5fd8', light: 0xff6fe0, light2: 0x6fe3ff, fog: 0x120a22 },
    props: 'lab',
    waves: [{ grunt: 4, shooter: 2 }, { drone: 4, grunt: 3 }, { shooter: 3, grunt: 4, drone: 2 }],
    taunt: 'ALIEN PA: "Do not let it near the other specimens. It is armed with... dairy?"',
  },
  {
    id: 'reactor',
    kicker: 'Deck 3',
    name: 'Reactor Core',
    w: 34, d: 26,
    theme: { floor: '#2a3a3a', seam: '#141f20', glow: '#8dff6a', wall: '#22302f', strip: '#ffb347', light: 0x9dff7a, light2: 0xffa94d, fog: 0x08140f },
    props: 'reactor',
    waves: [{ brute: 1, grunt: 4 }, { drone: 5, shooter: 2 }, { brute: 2, shooter: 2, grunt: 4 }],
    taunt: 'ALIEN PA: "The cow has reached the reactor. Release the Gloopzillas!"',
  },
  {
    id: 'bridge',
    kicker: 'Final deck',
    name: 'Command Bridge',
    w: 34, d: 28,
    theme: { floor: '#3a2a3a', seam: '#1c121c', glow: '#ff6b5a', wall: '#2e2133', strip: '#ffd84a', light: 0xff7a6a, light2: 0xffd84a, fog: 0x160a12 },
    props: 'bridge',
    waves: [{ boss: 1 }],
    taunt: 'OVERLORD ZYX: "So, the cow arrives. You will make excellent space cheese."',
    boss: true,
  },
];

export const ENEMY_INFO = {
  grunt: { score: 100 },
  shooter: { score: 150 },
  drone: { score: 120 },
  brute: { score: 400 },
  boss: { score: 5000 },
};
