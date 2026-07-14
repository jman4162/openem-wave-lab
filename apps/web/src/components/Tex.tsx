import katex from 'katex';
import 'katex/dist/katex.min.css';

/** LaTeX scientific notation, e.g. 2.99e8 -> "3.00\times10^{8}". */
export function texNum(value: number, digits = 3): string {
  if (value === 0) return '0';
  const exp = Math.floor(Math.log10(Math.abs(value)));
  if (exp >= -2 && exp <= 3) return value.toPrecision(digits);
  const mantissa = value / 10 ** exp;
  return `${mantissa.toPrecision(digits)}\\times10^{${exp}}`;
}

export const Tex = ({ children, block = false }: { children: string; block?: boolean }) => (
  <span
    dangerouslySetInnerHTML={{
      __html: katex.renderToString(children, { displayMode: block, throwOnError: false }),
    }}
  />
);
