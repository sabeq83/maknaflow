export const GRID_LAYOUT_COORDINATES = {
  3: {
    '3_split_left': [
      { id: 1, x: 0, y: 0, w: 6, h: 12 },
      { id: 2, x: 6, y: 0, w: 6, h: 6 },
      { id: 3, x: 6, y: 6, w: 6, h: 6 }
    ],
    '3_split_right': [
      { id: 1, x: 0, y: 0, w: 6, h: 6 },
      { id: 2, x: 0, y: 6, w: 6, h: 6 },
      { id: 3, x: 6, y: 0, w: 6, h: 12 }
    ],
    '3_stacked_horizontal': [
      { id: 1, x: 0, y: 0, w: 12, h: 3 },
      { id: 2, x: 0, y: 3, w: 12, h: 4 },
      { id: 3, x: 0, y: 7, w: 12, h: 5 }
    ]
  },
  4: {
    '4_editorial_split': [
      { id: 1, x: 0, y: 0, w: 7, h: 8 },
      { id: 2, x: 7, y: 0, w: 5, h: 4 },
      { id: 3, x: 7, y: 4, w: 5, h: 4 },
      { id: 4, x: 0, y: 8, w: 12, h: 4 }
    ],
    '4_modern_masonry': [
      { id: 1, x: 0, y: 0, w: 12, h: 5 },
      { id: 2, x: 0, y: 5, w: 6, h: 4 },
      { id: 3, x: 6, y: 5, w: 6, h: 7 },
      { id: 4, x: 0, y: 9, w: 6, h: 3 }
    ],
    '4_landscape_cascade': [
      { id: 1, x: 0, y: 0, w: 12, h: 3 },
      { id: 2, x: 0, y: 3, w: 12, h: 2.5 },
      { id: 3, x: 0, y: 5.5, w: 12, h: 3.5 },
      { id: 4, x: 0, y: 9, w: 12, h: 3 }
    ]
  },
  5: {
    '5_pentagon_grid': [
      { id: 1, x: 0, y: 0, w: 6, h: 4 },
      { id: 2, x: 6, y: 0, w: 6, h: 3 },
      { id: 3, x: 0, y: 4, w: 7, h: 5 },
      { id: 4, x: 7, y: 3, w: 5, h: 6 },
      { id: 5, x: 0, y: 9, w: 12, h: 3 }
    ],
    '5_step_cascade': [
      { id: 1, x: 0, y: 0, w: 8, h: 2.4 },
      { id: 2, x: 4, y: 2.4, w: 8, h: 2.4 },
      { id: 3, x: 0, y: 4.8, w: 7, h: 2.4 },
      { id: 4, x: 5, y: 7.2, w: 7, h: 2.4 },
      { id: 5, x: 0, y: 9.6, w: 12, h: 2.4 }
    ],
    '5_magazine_editorial': [
      { id: 1, x: 0, y: 0, w: 4, h: 12 },
      { id: 2, x: 4, y: 0, w: 4, h: 4 },
      { id: 3, x: 8, y: 0, w: 4, h: 4 },
      { id: 4, x: 4, y: 4, w: 4, h: 4 },
      { id: 5, x: 8, y: 4, w: 4, h: 4 }
    ]
  },
  6: {
    '6_magazine_spread': [
      { id: 1, x: 0, y: 0, w: 4, h: 4 },
      { id: 2, x: 4, y: 0, w: 8, h: 4 },
      { id: 3, x: 0, y: 4, w: 8, h: 4 },
      { id: 4, x: 8, y: 4, w: 4, h: 4 },
      { id: 5, x: 0, y: 8, w: 6, h: 4 },
      { id: 6, x: 6, y: 8, w: 6, h: 4 }
    ],
    '6_vertical_masonry': [
      { id: 1, x: 0, y: 0, w: 6, h: 3 },
      { id: 2, x: 6, y: 0, w: 6, h: 4 },
      { id: 3, x: 0, y: 3, w: 6, h: 5 },
      { id: 4, x: 6, y: 4, w: 6, h: 4 },
      { id: 5, x: 6, y: 8, w: 6, h: 4 },
      { id: 6, x: 0, y: 8, w: 6, h: 4 }
    ],
    '6_asymmetric_mosaic': [
      { id: 1, x: 0, y: 0, w: 4, h: 3 },
      { id: 2, x: 4, y: 0, w: 4, h: 3 },
      { id: 3, x: 8, y: 0, w: 4, h: 3 },
      { id: 4, x: 0, y: 3, w: 6, h: 5 },
      { id: 5, x: 6, y: 3, w: 6, h: 5 },
      { id: 6, x: 0, y: 8, w: 12, h: 4 }
    ]
  }
};
