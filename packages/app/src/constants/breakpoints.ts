export const APP_BREAKPOINTS = {
  xs: 0,
  sm: 576,
  md: 720,
  lg: 992,
  xl: 1200,
};

export function isCompactWindowWidth(width: number): boolean {
  return width < APP_BREAKPOINTS.md;
}
