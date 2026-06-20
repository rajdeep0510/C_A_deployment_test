export const getStockfish18Path = (lite?: boolean): string => {
  const base = "/engines/stockfish-18/stockfish-18";
  return `${base}${lite ? "-lite" : ""}-single${lite ? "" : "-6563532"}.js`;
};

export const getBestEnginePath = (): { path: string; lite: boolean } => {
  const lite = false;
  return { path: getStockfish18Path(lite), lite };
};
