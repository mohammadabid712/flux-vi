const fs = require('fs');
const nodePath = require('path');
const crypto = require('crypto');

// Only packages that forward dataSet to RNW; consumers such as react-native-gifted-charts must never be included.
const DATA_SET_FORWARDERS = new Set([
  'react-native',
  'react-native-web',
  'expo-image',
  '@expo/vector-icons',
  'react-native-safe-area-context',
  'react-native-reanimated',
  'expo-linear-gradient',
  'expo-router',
  'react-native-gesture-handler',
  'react-native-svg',
  'expo-blur',
  'react-native-screens',
  '@react-navigation/elements',
  '@react-navigation/native',
]);

// The deterministic style editor (claude_code_service/style_edit.py) reads one
// fragment per content of a source file from here: <sha1(file)>/<sha1(content)>.json.
// Offsets are JS string (UTF-16) indices into that content.
const STYLE_MAP_DIR = nodePath.join('.expo', 'fastshot-style-map');
// Fragments kept per file, most recently written or edited from first: more than the contents a
// file is built with while Metro's cache lives (a pod's life), few enough for the workspace backup.
const KEPT_CONTENTS = 100;

// The app's root layouts (expo-router's `app/` or `src/app/`).
const ROOT_LAYOUT = /^(src\/)?app\/_layout\.[jt]sx?$/;

module.exports = function ({ types: t, template }) {
  return {
    name: 'source-metadata',
    visitor: {
      Program: {
        enter(path, state) {
          // Recorded before preset plugins rewrite react-native imports and drop their bindings.
          state._imports = {};
          state._pressables = new Set();
          for (const statement of path.node.body) {
            if (!t.isImportDeclaration(statement)) continue;
            for (const specifier of statement.specifiers) {
              state._imports[specifier.local.name] = statement.source.value;
              if (t.isIdentifier(specifier.imported, { name: 'Pressable' })) state._pressables.add(specifier.local.name);
            }
          }
          state._sheets = {};
          state._elements = [];
          // Names this content's map, and goes with every key: the pod edits by a key only in the content it was picked in.
          state._sha1 = crypto.createHash('sha1').update(state.file.code).digest('hex');
          // Each element's place among the elements its line starts, in the untransformed file.
          state._ordinals = new Map();
          const counts = {};
          path.traverse({
            JSXOpeningElement(element) {
              const { loc, start } = element.node;
              if (loc) state._ordinals.set(start, (counts[loc.start.line] = (counts[loc.start.line] ?? -1) + 1));
            },
          });
        },
        exit(path, state) {
          // The inspector overlay gets the app's navigation: a save's reload opens the edited screen alone, and the
          // editor gives the app back the screens that led to it. A function, called only by the overlay.
          if (ROOT_LAYOUT.test(nodePath.relative(state.cwd || process.cwd(), state.filename || ''))) {
            path.pushContainer('body', template.statement.ast`
              globalThis.__fastshotNavigation = () => require('expo-router').useNavigationContainerRef();
            `);
          }
          if (state._elements.length === 0 || !state._file) return;
          const entries = {};
          for (const element of state._elements) {
            const { styles, boundsMark, ...rest } = element;
            entries[element.key] = rest;
            if (!styles) continue;
            rest.styles = styles.map((entry) => _resolveEntry(entry, state));
            // The bound that wins, when the pod reads it as a number (Python's float of its source: a sign, separators,
            // a decimal point, an exponent; not hex or a constant).
            boundsMark.value = ['minWidth', 'maxWidth', 'minHeight', 'maxHeight']
              .map((name) => [name, _definer(rest.styles, name)])
              .filter(([, info]) => info && /^[-+]?([0-9]+\.?[0-9]*|\.[0-9]+)(e[-+]?[0-9]+)?$/i.test(info.raw.replace(/_/g, '')))
              .map(([name, info]) => `${name}:${Number(info.raw.replace(/_/g, ''))}`)
              .join(' ');
            // Pressable calls a function style with its pressed state: an expression the map cannot see into may be one.
            if (rest.pressable && rest.attr.kind === 'expr' && rest.styles.length === 1 && rest.styles[0].kind === 'unknown') {
              rest.attr = { ...rest.attr, kind: 'function' };
            }
          }
          _writeFragment(state, entries);
        },
      },

      CallExpression(path, state) {
        if (
          t.isMemberExpression(path.node.callee) &&
          t.isIdentifier(path.node.callee.object, { name: 'StyleSheet' }) &&
          t.isIdentifier(path.node.callee.property, { name: 'create' }) &&
          path.node.arguments.length === 1 &&
          t.isObjectExpression(path.node.arguments[0])
        ) {
          const parent = path.parentPath;
          if (!parent.isVariableDeclarator() || !t.isIdentifier(parent.node.id)) return;
          // A spread or computed key among the entries may replace any of them: none is known to be the one in use.
          if (path.node.arguments[0].properties.some((member) => !_propertyName(t, member))) return;
          const declarations = {};
          for (const styleProp of path.node.arguments[0].properties) {
            const key = _propertyName(t, styleProp);
            // Of two entries with one key the last is used; one the map cannot read leaves the key unknown.
            if (t.isObjectExpression(styleProp.value)) declarations[key] = _objectInfo(t, styleProp.value, state.file.code);
            else delete declarations[key];
          }
          // Which elements share an entry: every use of this binding (not of its name, which a local may shadow).
          // Exported, or used other than as `styles.key` or `styles['key']`, any entry may style elements never seen here.
          const binding = parent.scope.getBinding(parent.node.id.name);
          let escaped = !binding || parent.parentPath.parentPath.isExportNamedDeclaration();
          const refs = {};
          for (const ref of binding ? binding.referencePaths : []) {
            const key = ref.parentPath.isMemberExpression({ object: ref.node }) ? _memberKey(t, ref.parent) : null;
            if (key === null) escaped = true;
            // Later plugins requeue moved nodes (JSX becomes calls): count each source position once.
            else (refs[key] = refs[key] || new Set()).add(ref.node.start);
          }
          state._sheets[parent.node.id.start] = { declarations, refs, escaped };
        }
      },

      JSXOpeningElement(path, state) {
        const loc = path.node.loc;
        if (!loc) return;

        const elementName = path.node.name;
        if (t.isJSXIdentifier(elementName) && elementName.name === 'Fragment') return;
        if (
          t.isJSXMemberExpression(elementName) &&
          elementName.property.name === 'Fragment'
        )
          return;

        const filename = state.filename || '';
        const cwd = state.cwd || process.cwd();
        const relativeFile = filename.startsWith(cwd)
          ? filename.slice(cwd.length + 1)
          : filename;
        if (relativeFile.includes('node_modules')) return;
        state._file = relativeFile;

        let root = elementName;
        while (t.isJSXMemberExpression(root)) {
          root = root.object;
        }
        const binding = t.isJSXIdentifier(root) && path.scope.getBinding(root.name);
        if (binding && binding.path.parentPath.isImportDeclaration()) {
          const source = binding.path.parentPath.node.source.value;
          if (
            !source.startsWith('.') &&
            !source.startsWith('/') &&
            !source.startsWith('@/') &&
            !_isForwarder(source)
          ) {
            return;
          }
        }

        let componentName = '';
        let current = path.parentPath;
        while (current) {
          if (current.isFunctionDeclaration() && current.node.id) {
            componentName = current.node.id.name;
            break;
          }
          if (current.isVariableDeclarator() && t.isIdentifier(current.node.id)) {
            componentName = current.node.id.name;
            break;
          }
          current = current.parentPath;
        }

        const line = loc.start.line;
        // Elements written on one line get `#1`, `#2`... after the line. Style edits keep every line and
        // every element, so a key picked before an edit still names the same element after it.
        const ordinal = state._ordinals.get(path.node.start);
        const position = `${relativeFile}:${line}${ordinal ? `#${ordinal}` : ''}`;
        const sourceValue = componentName ? `${componentName}@${position}` : position;

        // Read before the dataSet attribute below is added: new nodes carry no offsets.
        const code = state.file.code;
        const nameNode = path.node.typeArguments || path.node.typeParameters || elementName;
        const element = {
          key: sourceValue,
          line,
          name: code.slice(elementName.start, elementName.end),
          // A forwarder's component takes a style array; an app component's style prop may not.
          // Not a parameter or local named like an import. The preset may have removed the import's declaration by now,
          // leaving its binding, of kind 'module'.
          host: t.isJSXIdentifier(root) && (!binding || binding.kind === 'module') && _isForwarder(state._imports[root.name] || ''),
          pressable: /(^|\.)Pressable$/.test(code.slice(elementName.start, elementName.end)) || state._pressables.has(root.name) || undefined,
          nameEnd: nameNode.end,
          attr: null,
        };
        const styleAttr = path.node.attributes.findLast(
          (attr) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'style',
        );
        // `<View style={s} {...props} />`: a spread after the style (or with no style) may replace it.
        const spreadAt = path.node.attributes.findLastIndex((attr) => t.isJSXSpreadAttribute(attr));
        if (spreadAt > path.node.attributes.indexOf(styleAttr)) element.spreadOverStyle = true;
        if (styleAttr && t.isJSXExpressionContainer(styleAttr.value)) {
          const expr = _unwrap(t, styleAttr.value.expression);
          element.attr = {
            start: expr.start,
            end: expr.end,
            kind: t.isObjectExpression(expr)
              ? 'object'
              : t.isArrayExpression(expr)
                ? 'array'
                : t.isFunction(expr)
                  ? 'function'
                  : 'expr',
          };
          const last = t.isArrayExpression(expr) && expr.elements.findLast(Boolean);
          if (last) element.attr.lastEnd = last.end;
          element.styles = _collectStyleEntries(t, expr, code, path.scope);
        } else if (styleAttr) {
          element.attr = { kind: 'expr', start: -1, end: -1 };
          element.styles = [{ kind: 'unknown' }];
        }
        // The packages' components that take a `source` draw it as a picture; an app's own may mean anything by it.
        const imageAttr =
          element.host &&
          path.node.attributes.findLast((attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name: 'source' }));
        if (imageAttr) {
          element.image = spreadAt > path.node.attributes.indexOf(imageAttr) ? { kind: 'other' } : _imageSource(t, imageAttr.value, code);
        }
        state._elements.push(element);

        const sourceProp = t.objectProperty(
          t.identifier('source'),
          t.stringLiteral(sourceValue),
        );
        const hashProp = t.objectProperty(t.identifier('sourceHash'), t.stringLiteral(state._sha1));
        // The inspector tells an image from a box by this, a picture that failed to load included.
        const marks = imageAttr ? [['sourceImage', t.numericLiteral(1)]] : [];
        // The size bounds its own styles write as numbers, which a size preview may move as the save does: known once
        // the file's StyleSheets are read (see exit).
        if (element.styles) marks.push(['sourceBounds', (element.boundsMark = t.stringLiteral(''))]);

        const existingDataSet = path.node.attributes.find(
          (attr) =>
            t.isJSXAttribute(attr) &&
            t.isJSXIdentifier(attr.name) &&
            attr.name.name === 'dataSet',
        );

        if (existingDataSet && t.isJSXExpressionContainer(existingDataSet.value)) {
          const expr = existingDataSet.value.expression;
          if (t.isObjectExpression(expr)) {
            const hasSource = expr.properties.some(
              (p) => t.isObjectProperty(p) && t.isIdentifier(p.key, { name: 'source' }),
            );
            if (!hasSource) {
              expr.properties.push(sourceProp, hashProp, ...marks.map(([key, value]) => t.objectProperty(t.identifier(key), value)));
            }
          }
        } else {
          // React Native Web enumerates dataSet's own keys into data-* attributes,
          // so an empty array carrying `source` renders the same data-source as an
          // object. A package component that reads dataSet as its own prop
          // (react-native-gifted-charts: multi-series data) then sees an empty
          // list instead of an object and does not throw on .map/.length.
          // Built through a program-unique temp declared at module scope, so the
          // emitted code references no global an app binding could shadow and
          // the temp is visible from any JSX position (parameter defaults, class
          // fields, rest-parameter arrows).
          const tag = path.scope.generateUidIdentifier('src');
          path.scope.getProgramParent().push({ id: tag });
          path.node.attributes.push(
            t.jsxAttribute(
              t.jsxIdentifier('dataSet'),
              t.jsxExpressionContainer(
                t.sequenceExpression([
                  t.assignmentExpression('=', t.cloneNode(tag), t.arrayExpression([])),
                  t.assignmentExpression(
                    '=',
                    t.memberExpression(t.cloneNode(tag), t.identifier('source')),
                    t.stringLiteral(sourceValue),
                  ),
                  t.assignmentExpression(
                    '=',
                    t.memberExpression(t.cloneNode(tag), t.identifier('sourceHash')),
                    t.stringLiteral(state._sha1),
                  ),
                  ...marks.map(([key, value]) =>
                    t.assignmentExpression('=', t.memberExpression(t.cloneNode(tag), t.identifier(key)), value),
                  ),
                  t.cloneNode(tag),
                ]),
              ),
            ),
          );
        }
      },
    },
  };
};

function _isForwarder(source) {
  return [...DATA_SET_FORWARDERS].some((entry) => source === entry || source.startsWith(entry + '/'));
}

function _propertyName(t, prop) {
  if (!t.isObjectProperty(prop) || prop.computed) return null;
  if (t.isIdentifier(prop.key)) return prop.key.name;
  if (t.isStringLiteral(prop.key)) return prop.key.value;
  return null;
}

// `styles.key` or `styles['key']`; null for any other use of `styles`.
function _memberKey(t, member) {
  if (!member.computed && t.isIdentifier(member.property)) return member.property.name;
  if (member.computed && t.isStringLiteral(member.property)) return member.property.value;
  return null;
}

function _isLiteral(t, node) {
  return (
    t.isNumericLiteral(node) ||
    t.isStringLiteral(node) ||
    (t.isUnaryExpression(node) && node.operator === '-' && t.isNumericLiteral(node.argument))
  );
}

// Every member of a style object, literal or not, with the offsets needed to
// replace a value or append a property after the last member.
function _objectInfo(t, objExpr, code) {
  const props = {};
  let lastEnd = -1;
  let spreadEnd = -1;
  for (const member of objExpr.properties) {
    lastEnd = member.end;
    const name = _propertyName(t, member);
    // A spread, a computed key or a method may set any property: the members before it are not known to win.
    if (!name) {
      spreadEnd = member.end;
      continue;
    }
    const value = member.value;
    props[name] = {
      start: value.start,
      end: value.end,
      raw: code.slice(value.start, value.end),
      literal: _isLiteral(t, value),
      line: value.loc.start.line,
    };
    if (member.shorthand) props[name].shorthand = true;
    // `active ? a : b`, `active && a`: one value per state; replacing it would erase the difference.
    if (t.isConditionalExpression(_unwrap(t, value)) || t.isLogicalExpression(_unwrap(t, value))) props[name].state = true;
  }
  return { start: objExpr.start, end: objExpr.end, props, lastEnd, spreadEnd };
}

function _isEmptyStyle(t, node) {
  return (
    t.isNullLiteral(node) ||
    t.isBooleanLiteral(node, { value: false }) ||
    t.isIdentifier(node, { name: 'undefined' })
  );
}

function _branch(t, wrapped, code, scope) {
  const node = _unwrap(t, wrapped);
  if (_isEmptyStyle(t, node)) return { kind: 'empty' };
  if (t.isObjectExpression(node)) return { kind: 'inline', ..._objectInfo(t, node, code) };
  const key = t.isMemberExpression(node) && t.isIdentifier(node.object) ? _memberKey(t, node) : null;
  if (key !== null) {
    const binding = scope.getBinding(node.object.name);
    return { kind: 'ref', sheet: binding && binding.identifier.start, varName: node.object.name, key };
  }
  return null;
}

// Where an image's source can be swapped for a project asset: the path inside
// `require('...')`, or a literal `{ uri: '...' }` / string source. A source that
// comes from data (`source={photo}`) is not recorded: swapping it here would
// change every image the data feeds.
function _imageSource(t, value, code) {
  if (t.isStringLiteral(value)) return { kind: 'uri', start: value.start, end: value.end, attr: true };
  if (!t.isJSXExpressionContainer(value)) return { kind: 'other' };
  const expr = _unwrap(t, value.expression);
  if (
    t.isCallExpression(expr) &&
    t.isIdentifier(expr.callee, { name: 'require' }) &&
    expr.arguments.length === 1 &&
    t.isStringLiteral(expr.arguments[0])
  ) {
    const arg = expr.arguments[0];
    return { kind: 'require', start: arg.start, end: arg.end, raw: code.slice(arg.start, arg.end) };
  }
  const uri = t.isObjectExpression(expr) && expr.properties.length === 1 && expr.properties[0];
  if (t.isStringLiteral(expr) || (uri && _propertyName(t, uri) === 'uri' && t.isStringLiteral(uri.value))) {
    return { kind: 'uri', start: expr.start, end: expr.end };
  }
  return { kind: 'other' };
}

function _unwrap(t, node) {
  while (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node) || t.isParenthesizedExpression(node)) {
    node = node.expression;
  }
  return node;
}

function _collectStyleEntries(t, node, code, scope) {
  const expr = _unwrap(t, node);
  if (t.isArrayExpression(expr)) {
    const entries = [];
    for (const el of expr.elements) {
      if (!el) continue;
      if (t.isSpreadElement(el)) entries.push({ kind: 'unknown' });
      else entries.push(..._collectStyleEntries(t, el, code, scope));
    }
    return entries;
  }
  if (_isEmptyStyle(t, expr)) return [];
  const direct = _branch(t, expr, code, scope);
  if (direct) return [direct];
  // `cond && styles.x`, `cond ? a : b`, `a || b`, `a ?? b`: a state-dependent style. Where its
  // branches are known, a property none of them sets can be edited past it.
  const branches =
    t.isLogicalExpression(expr, { operator: '&&' })
      ? [expr.right]
      : t.isLogicalExpression(expr)
        ? [expr.left, expr.right]
        : t.isConditionalExpression(expr)
          ? [expr.consequent, expr.alternate]
          : null;
  if (branches) return [{ kind: 'cond', branches: branches.map((node) => _branch(t, node, code, scope) || { kind: 'unknown' }) }];
  return [{ kind: 'unknown' }];
}

function _resolveRef(branch, state) {
  if (branch.kind !== 'ref') return branch;
  const sheet = state._sheets[branch.sheet];
  const declaration = sheet && sheet.declarations[branch.key];
  if (!declaration) return null;
  const shared = sheet.escaped ? 'exported' : (sheet.refs[branch.key] || new Set()).size;
  return { kind: 'sheet', ref: `${branch.varName}.${branch.key}`, shared, ...declaration };
}

// What sets a property last, as the pod reads the map (style_edit._definer): the info of the object or StyleSheet
// entry of this file that does, when nothing after it (a condition, an entry the map cannot see into, a spread) may
// override it; else null.
function _definer(styles, prop) {
  for (let i = styles.length - 1; i >= 0; i--) {
    const style = styles[i];
    if (style.kind === 'cond') {
      if (style.props.includes(prop) || style.spread) return null;
      continue;
    }
    if (style.kind === 'unknown') return null;
    const info = style.props[prop];
    if (info) return info.state || info.start < style.spreadEnd ? null : info;
    if (style.spreadEnd >= 0) return null;
  }
  return null;
}

function _resolveEntry(entry, state) {
  if (entry.kind === 'ref') return _resolveRef(entry, state) || { kind: 'unknown' };
  if (entry.kind !== 'cond') return entry;
  const props = new Set();
  for (const branch of entry.branches) {
    const resolved = _resolveRef(branch, state);
    // A state's style the map cannot see into, or with a spread or computed key, may set any property in that state.
    if (!resolved || resolved.kind === 'unknown' || resolved.spreadEnd >= 0) return { kind: 'cond', props: [...props], spread: true };
    Object.keys(resolved.props || {}).forEach((name) => props.add(name));
  }
  return { kind: 'cond', props: [...props] };
}

function _writeFragment(state, entries) {
  const cwd = state.cwd || process.cwd();
  const file = state._file;
  const sha1 = state._sha1;
  // Metro does not transform again (and this plugin does not run) for a content it has cached: an
  // edit back to such a content finds the fragment written when that content was first built.
  const dir = nodePath.join(cwd, STYLE_MAP_DIR, crypto.createHash('sha1').update(file).digest('hex'));
  fs.mkdirSync(dir, { recursive: true });
  // Metro transforms files in parallel workers: each fragment is written atomically.
  const tmp = nodePath.join(dir, `${sha1}.json.${process.pid}.tmp`);
  fs.writeFileSync(tmp, JSON.stringify({ version: 2, file, sha1, entries }));
  fs.renameSync(tmp, nodePath.join(dir, `${sha1}.json`));
  const kept = fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => ({ name, stat: fs.statSync(nodePath.join(dir, name), { throwIfNoEntry: false }) }))
    .filter((fragment) => fragment.stat)
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
  for (const { name } of kept.slice(KEPT_CONTENTS)) fs.rmSync(nodePath.join(dir, name), { force: true });
}
