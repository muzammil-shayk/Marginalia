/** "1 mark", "2 marks", "1,204 words": every count the app prints goes through here. */
export const noun = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

export const plural = (n: number, one: string, many?: string) => `${n.toLocaleString()} ${noun(n, one, many)}`;
