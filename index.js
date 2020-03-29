export function replaceRecursive(str, regex, newThing) {
  return regex.test(str)
    ? replaceRecursive(str.replace(regex, newThing), regex, newThing)
    : str;
}
export const parse = d =>
  d
    .trim()
    .split(/(?=[MmLlHhVvCcSsAaQqTtZz])/)
    .map(d => ({
      type: d.charAt(0),
      values: replaceRecursive(d.substr(1), /([0-9]*\.[0-9]*)\./, "$1 .")
        .replace(/([0-9.])-/g, "$1 -")
        .split(/[\n\s,]/)
        .filter(d => d.length)
        .map(d => +d)
    }));
export const stringify = pathObject =>
  pathObject.map(d => d.type + d.values.join(" ")).join("");
export const isRelative = d => d.type === d.type.toLowerCase();
export const paramLengths = {
  M: 2,
  m: 2,
  L: 2,
  l: 2,
  H: 1,
  h: 1,
  V: 1,
  v: 1,
  C: 6,
  c: 6,
  S: 4,
  s: 4,
  Q: 4,
  q: 4,
  T: 2,
  t: 2,
  A: 7,
  a: 7
};
export const normalizeImplicitCommandsObj = pathObject =>
  [].concat(
    ...pathObject.map(({ type, values }) => {
      if (!values.length)
        return {
          type,
          values
        };
      const chunks = [];
      for (let i = 0; i < values.length; i += paramLengths[type]) {
        chunks.push(values.slice(i, i + paramLengths[type]));
      }
      return chunks.map((chunk, i) => {
        let newType = type === "M" ? "L" : type === "m" ? "l" : type;
        return {
          type: i ? newType : type,
          values: chunk
        };
      });
    })
  );
export const applyXY = (x, y, rx, ry) => ({ type, values }) => {
  switch (type) {
    case "A":
    case "a":
      return values.map((d, i) => {
        switch (i % paramLengths[type]) {
          case 0:
            return rx ? rx(d) : d;
          case 1:
            return ry ? ry(d) : d;
          case 5:
            return x(d);
          case 6:
            return y(d);
          default:
            return d;
        }
      });
    case "H":
    case "h":
      return values.map(x);
    case "V":
    case "v":
      return values.map(y);
    default:
      return values.map((d, i) => (i % 2 ? y(d) : x(d)));
  }
};
export const getEndPoint = (
  { type, values },
  [x = 0, y = 0],
  [x0 = 0, y0 = 0]
) => {
  switch (type) {
    case "A":
    case "C":
    case "L":
    case "M":
    case "Q":
    case "S":
    case "T":
      return values.slice(values.length - 2);
    case "H":
      return [values[values.length - 1], y];
    case "V":
      return [x, values[values.length - 1]];
    case "a":
    case "c":
    case "l":
    case "m":
    case "q":
    case "s":
    case "t":
      const [dx, dy] = values.slice(values.length - 2);
      return [x + dx, y + dy];
    case "h":
      return [x + values[values.length - 1], y];
    case "v":
      return [x, y + values[values.length - 1]];
    case "Z":
    case "z":
      return [x0, y0];
    default:
      return [x, y];
  }
};
export function toAbsoluteObj(pathObject, last = [0, 0], initial = [0, 0]) {
  if (!pathObject.length) return [];
  const [first, ...rest] = normalizeImplicitCommandsObj(pathObject);
  const newFirst = {
    type: first.type.toUpperCase(),
    values: isRelative(first)
      ? applyXY(
          x => x + last[0],
          y => y + last[1]
        )(first)
      : first.values
  };
  last = getEndPoint(newFirst, last, initial);
  if (newFirst.type === "M") initial = last;
  return [newFirst, ...toAbsoluteObj(rest, last, initial)];
}
export const getX = ({ type, values }) => {
  switch (type) {
    case "A":
    case "a":
      return [values[5] - values[0], values[5] + values[0]];
    case "H":
      return values;
    case "V":
      return [];
    case "L":
    case "l":
      return values.filter((_, i) => !(i % 2));
    case "C":
    case "c":
      return values.filter((_, i) => i % 6 === 4);
    case "Q":
    case "q":
      return values.filter((_, i) => i % 4 === 2);
    default:
      return values.filter((_, i) => !(i % 2));
  }
};
export const getY = ({ type, values }) => {
  switch (type) {
    case "A":
    case "a":
      return [values[6] - values[1], values[6] + values[1]];
    case "H":
      return [];
    case "V":
      return values;
    case "L":
    case "l":
      return values.filter((_, i) => i % 2);
    case "C":
    case "c":
      return values.filter((_, i) => i % 6 === 5);
    case "Q":
    case "q":
      return values.filter((_, i) => i % 4 === 3);
    default:
      return values.filter((_, i) => i % 2);
  }
};
export const getBBoxObj = pathObject => {
  if (pathObject.some(isRelative)) pathObject = toAbsoluteObj(pathObject);
  const x = [].concat(...pathObject.map(getX));
  const x0 = Math.min(...x);
  const x1 = Math.max(...x);
  const y = [].concat(...pathObject.map(getY));
  const y0 = Math.min(...y);
  const y1 = Math.max(...y);
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0
  };
};
export const getBBox = pathString => getBBoxObj(parse(pathString));
export const translateObj = (x, y) => pathObject =>
  toAbsoluteObj(pathObject).map(({ type, values }) => ({
    type,
    values: applyXY(
      d => d + x,
      d => d + y
    )({
      type,
      values
    })
  }));
export const centerObj = pathObject => {
  if (pathObject.some(isRelative)) pathObject = toAbsoluteObj(pathObject);
  const bb = getBBoxObj(pathObject);
  return translateObj(
    -(2 * bb.x + bb.width) / 2,
    -(2 * bb.y + bb.height) / 2
  )(pathObject);
};
export const center = pathString => stringify(centerObj(parse(pathString)));
export const translate = (x, y) => pathString =>
  stringify(translateObj(x, y)(parse(pathString)));
export const scaleObj = (x, y) => {
  if (!y) y = x;
  if (typeof x === "number") {
    let _x = x;
    x = d => d * _x;
  }
  if (typeof y === "number") {
    let _y = y;
    y = d => d * _y;
  }
  return pathObject =>
    pathObject.map(({ type, values }) => ({
      type,
      values: applyXY(
        x,
        y,
        x,
        y
      )({
        type,
        values
      })
    }));
};
export const scale = (x, y) => pathString =>
  stringify(scaleObj(x, y)(parse(pathString)));

export const sizeObj = (w = Infinity, h = Infinity) => pathObject => {
  const bb = getBBoxObj(pathObject);
  const ratio = Math.min(w / bb.width, h / bb.height);
  return scaleObj(ratio)(pathObject);
};
export const size = (w, h) => pathString =>
  stringify(sizeObj(w, h)(parse(pathString)));
export const combine = arr =>
  arr
    .map(parse)
    .map(path => {
      if (path[0].type === "m" && path[0].values.length > 2) {
        return [
          {
            type: "M",
            values: path[0].values.slice(0, 2)
          },
          {
            type: "l",
            values: path[0].values.slice(2)
          },
          ...path.slice(1)
        ];
      } else if (path[0].type === "m") {
        return [
          {
            type: "M",
            values: path[0].values
          },
          ...path.slice(1)
        ];
      }
      return path;
    })
    .map(stringify)
    .join("");
export const toAbsolute = pathString =>
  stringify(toAbsoluteObj(parse(pathString)));
export const compressObj = precision => pathObject =>
  pathObject.map(({ type, values }) => ({
    type,
    values: values.map(d => +d.toFixed(precision))
  }));
export const compress = precision => pathString =>
  stringify(compressObj(precision)(parse(pathString)));
export const normalizeImplicitCommands = pathString =>
  stringify(normalizeImplicitCommandsObj(parse(pathString)));
export function normalizeHVObj(pathObject, initial = [0, 0]) {
  if (!pathObject.length) return [];
  const [{ type, values }, ...rest] = pathObject;
  let newValues;
  switch (type) {
    case "H":
      newValues = [values[0], initial[1]];
      return [
        {
          type: "L",
          values: newValues
        },
        ...normalizeHVObj(rest, newValues)
      ];
    case "V":
      newValues = [initial[0], values[0]];
      return [
        {
          type: "L",
          values: newValues
        },
        ...normalizeHVObj(rest, newValues)
      ];
    default:
      return [
        {
          type,
          values
        },
        ...normalizeHVObj(rest, type === "C" ? values.slice(4) : values)
      ];
  }
}
export const normalizeHV = pathString =>
  stringify(normalizeHVObj(parse(pathString)));
export default {
  parse,
  stringify,
  getBBox,
  center,
  translate,
  scale,
  size,
  combine,
  toAbsolute,
  compress,
  normalizeImplicitCommands,
  normalizeHV
};
