import { useMemo } from "react";
import { parseFurigana } from "../lib/furigana";

interface Props {
  text: string;
  /** 후리가나를 보여줄지. 끄면 자리는 유지한 채 투명하게만 만들어 레이아웃이 흔들리지 않는다. */
  show: boolean;
  className?: string;
}

export function Furigana({ text, show, className }: Props) {
  const tokens = useMemo(() => parseFurigana(text), [text]);
  return (
    <span className={className}>
      {tokens.map((token, i) =>
        token.kind === "text" ? (
          <span key={i}>{token.text}</span>
        ) : (
          <ruby key={i} className={show ? undefined : "rb-hidden"}>
            {token.base}
            <rt>{token.reading}</rt>
          </ruby>
        ),
      )}
    </span>
  );
}
