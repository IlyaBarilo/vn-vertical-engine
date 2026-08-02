/* expression.js
   Общая безопасная грамматика выражений для загрузчика и runtime без eval и Function.
*/
(function(global) {
  "use strict";

  var BINARY_PRECEDENCE = {
    "||": 1,
    "&&": 2,
    "==": 3,
    "!=": 3,
    "===": 3,
    "!==": 3,
    ">": 4,
    ">=": 4,
    "<": 4,
    "<=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    "%": 6
  };

  // Определяет служебные литералы, которые не требуется искать среди переменных истории.
  function isLiteralIdentifier(name) {
    return name === "true" || name === "false" || name === "null" || name === "undefined";
  }

  // Запрещает доступ к глобальным объектам и прототипным ключам во всех режимах разбора.
  function isUnsafeIdentifier(name) {
    return (
      name === "window" ||
      name === "document" ||
      name === "globalThis" ||
      name === "this" ||
      name === "__proto__" ||
      name === "prototype" ||
      name === "constructor"
    );
  }

  // Разбирает исходную строку на единый набор безопасных токенов для проверки и вычисления.
  function tokenizeExpression(expression) {
    var tokens = [];
    var i = 0;
    var source = String(expression || "");
    var operators3 = { "===": true, "!==": true };
    var operators2 = { "&&": true, "||": true, "==": true, "!=": true, ">=": true, "<=": true };
    var operators1 = { "+": true, "-": true, "*": true, "/": true, "%": true, ">": true, "<": true, "!": true };

    while (i < source.length) {
      var ch = source.charAt(i);

      if (/\s/.test(ch)) {
        i += 1;
        continue;
      }

      var op3 = source.substring(i, i + 3);
      if (operators3[op3]) {
        tokens.push({ type: "operator", value: op3 });
        i += 3;
        continue;
      }

      var op2 = source.substring(i, i + 2);
      if (operators2[op2]) {
        tokens.push({ type: "operator", value: op2 });
        i += 2;
        continue;
      }

      if (operators1[ch]) {
        tokens.push({ type: "operator", value: ch });
        i += 1;
        continue;
      }

      if (ch === "(" || ch === ")") {
        tokens.push({ type: "paren", value: ch });
        i += 1;
        continue;
      }

      if (ch === "'" || ch === '"') {
        var quote = ch;
        var value = "";
        var escaped = false;
        i += 1;

        while (i < source.length) {
          var stringChar = source.charAt(i);
          if (escaped) {
            if (stringChar === "n") value += "\n";
            else if (stringChar === "t") value += "\t";
            else if (stringChar === "r") value += "\r";
            else value += stringChar;
            escaped = false;
            i += 1;
            continue;
          }
          if (stringChar === "\\") {
            escaped = true;
            i += 1;
            continue;
          }
          if (stringChar === quote) {
            i += 1;
            break;
          }
          value += stringChar;
          i += 1;
        }

        if (i > source.length || source.charAt(i - 1) !== quote) {
          throw new Error("Unclosed string literal");
        }
        tokens.push({ type: "string", value: value });
        continue;
      }

      if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source.charAt(i + 1)))) {
        var numberStart = i;
        var hasDot = ch === ".";
        i += 1;

        while (i < source.length) {
          var numberChar = source.charAt(i);
          if (/[0-9]/.test(numberChar)) {
            i += 1;
            continue;
          }
          if (numberChar === "." && !hasDot) {
            hasDot = true;
            i += 1;
            continue;
          }
          break;
        }

        var numberRaw = source.substring(numberStart, i);
        var numberValue = Number(numberRaw);
        if (!isFinite(numberValue)) {
          throw new Error("Invalid number literal: " + numberRaw);
        }
        tokens.push({ type: "number", value: numberValue });
        continue;
      }

      if (/[A-Za-z_]/.test(ch)) {
        var identifierStart = i;
        i += 1;
        while (i < source.length && /[A-Za-z0-9_]/.test(source.charAt(i))) {
          i += 1;
        }
        tokens.push({ type: "identifier", value: source.substring(identifierStart, i) });
        continue;
      }

      throw new Error("Unsupported symbol: " + ch);
    }

    tokens.push({ type: "eof", value: "" });
    return tokens;
  }

  // Возвращает текущий токен parser без изменения позиции.
  function currentToken(parser) {
    return parser.tokens[parser.cursor];
  }

  // Требует ожидаемый токен и переводит parser вперёд с единым форматом ошибки.
  function consumeToken(parser, type, value) {
    var token = currentToken(parser);
    if (!token || token.type !== type || (value !== undefined && token.value !== value)) {
      var actual = token ? (token.type + ":" + token.value) : "EOF";
      throw new Error("Unexpected token: " + actual);
    }
    parser.cursor += 1;
    return token;
  }

  // Возвращает приоритет бинарного оператора или ноль для токена другого типа.
  function getBinaryPrecedence(token) {
    if (!token || token.type !== "operator") return 0;
    return BINARY_PRECEDENCE[token.value] || 0;
  }

  // Разбирает бинарные операции методом precedence climbing с прежней левой ассоциативностью.
  function parseBinaryExpression(parser, minimumPrecedence) {
    var left = parseUnaryExpression(parser);
    var precedence = getBinaryPrecedence(currentToken(parser));

    while (precedence >= minimumPrecedence && precedence > 0) {
      var operator = consumeToken(parser, "operator").value;
      var right = parseBinaryExpression(parser, precedence + 1);
      left = {
        type: "binary",
        operator: operator,
        left: left,
        right: right
      };
      precedence = getBinaryPrecedence(currentToken(parser));
    }

    return left;
  }

  // Разбирает допустимые унарные операторы перед первичным выражением.
  function parseUnaryExpression(parser) {
    var token = currentToken(parser);
    if (token && token.type === "operator" && (token.value === "!" || token.value === "-")) {
      parser.cursor += 1;
      return {
        type: "unary",
        operator: token.value,
        operand: parseUnaryExpression(parser)
      };
    }
    return parsePrimaryExpression(parser);
  }

  // Разбирает литерал, безопасный идентификатор или выражение в скобках.
  function parsePrimaryExpression(parser) {
    var token = currentToken(parser);
    if (!token) {
      throw new Error("Unexpected end of expression");
    }

    if (token.type === "paren" && token.value === "(") {
      parser.cursor += 1;
      var inner = parseBinaryExpression(parser, 1);
      consumeToken(parser, "paren", ")");
      return inner;
    }

    if (token.type === "number" || token.type === "string") {
      parser.cursor += 1;
      return { type: "literal", value: token.value };
    }

    if (token.type === "identifier") {
      if (isUnsafeIdentifier(token.value)) {
        throw new Error("Unsafe identifier is not allowed: " + token.value);
      }
      parser.cursor += 1;
      return { type: "identifier", name: token.value };
    }

    throw new Error("Unexpected token: " + token.type + ":" + token.value);
  }

  // Строит единое AST и требует полного потребления исходной строки.
  function parseExpression(expression) {
    var parser = {
      tokens: tokenizeExpression(expression),
      cursor: 0
    };
    var root = parseBinaryExpression(parser, 1);
    consumeToken(parser, "eof");
    return root;
  }

  // Собирает имена пользовательских переменных из AST без вычисления выражения.
  function collectIdentifiers(node, identifiers) {
    if (!node) return;
    if (node.type === "identifier") {
      if (!isLiteralIdentifier(node.name)) {
        identifiers[node.name] = true;
      }
      return;
    }
    if (node.type === "unary") {
      collectIdentifiers(node.operand, identifiers);
      return;
    }
    if (node.type === "binary") {
      collectIdentifiers(node.left, identifiers);
      collectIdentifiers(node.right, identifiers);
    }
  }

  // Проверяет выражение и возвращает отсортированные имена переменных в прежнем формате runtime.
  function inspectExpression(expression) {
    var source = String(expression || "").trim();
    if (!source) {
      return { ok: false, identifiers: [], error: "Empty expression" };
    }

    try {
      var identifiers = {};
      collectIdentifiers(parseExpression(source), identifiers);
      return { ok: true, identifiers: Object.keys(identifiers).sort(), error: "" };
    } catch (error) {
      return {
        ok: false,
        identifiers: [],
        error: error && error.message ? error.message : String(error)
      };
    }
  }

  // Разрешает литералы и только собственные свойства переданного объекта переменных.
  function resolveIdentifier(name, vars) {
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "null") return null;
    if (name === "undefined") return undefined;

    if (isUnsafeIdentifier(name)) {
      throw new Error("Unsafe identifier is not allowed: " + name);
    }
    if (!vars || !Object.prototype.hasOwnProperty.call(vars, name)) {
      throw new Error("Unknown identifier: " + name);
    }
    return vars[name];
  }

  // Приводит арифметический операнд к конечному числу с понятным контекстом ошибки.
  function toFiniteNumber(value, context) {
    var numberValue = Number(value);
    if (!isFinite(numberValue)) {
      throw new Error((context || "Value") + " must be a finite number");
    }
    return numberValue;
  }

  // Сохраняет обычные JavaScript-правила truthy/falsy без выполнения пользовательского кода.
  function isTruthyValue(value) {
    return !!value;
  }

  // Применяет бинарный оператор к уже вычисленным сторонам, сохраняя прежние преобразования типов.
  function applyBinaryOperator(operator, left, right) {
    if (operator === "||") return isTruthyValue(left) ? left : right;
    if (operator === "&&") return isTruthyValue(left) ? right : left;
    if (operator === "==") return left == right; // eslint-disable-line eqeqeq
    if (operator === "!=") return left != right; // eslint-disable-line eqeqeq
    if (operator === "===") return left === right;
    if (operator === "!==") return left !== right;
    if (operator === ">") return left > right;
    if (operator === ">=") return left >= right;
    if (operator === "<") return left < right;
    if (operator === "<=") return left <= right;

    if (operator === "+") {
      if (typeof left === "string" || typeof right === "string") {
        return String(left) + String(right);
      }
      return toFiniteNumber(left, "Left side of +") + toFiniteNumber(right, "Right side of +");
    }
    if (operator === "-") {
      return toFiniteNumber(left, "Left side of -") - toFiniteNumber(right, "Right side of -");
    }
    if (operator === "*") {
      return toFiniteNumber(left, "Left side of *") * toFiniteNumber(right, "Right side of *");
    }
    if (operator === "/") {
      var divisor = toFiniteNumber(right, "Right side of /");
      if (divisor === 0) throw new Error("Division by zero is not allowed");
      return toFiniteNumber(left, "Left side of /") / divisor;
    }
    if (operator === "%") {
      var modulo = toFiniteNumber(right, "Right side of %");
      if (modulo === 0) throw new Error("Modulo by zero is not allowed");
      return toFiniteNumber(left, "Left side of %") % modulo;
    }

    throw new Error("Unsupported operator: " + operator);
  }

  // Вычисляет AST рекурсивно; обе стороны логических операторов обрабатываются для legacy-совместимости.
  function evaluateNode(node, vars) {
    if (node.type === "literal") return node.value;
    if (node.type === "identifier") return resolveIdentifier(node.name, vars);
    if (node.type === "unary") {
      var operand = evaluateNode(node.operand, vars);
      if (node.operator === "!") return !isTruthyValue(operand);
      if (node.operator === "-") return -toFiniteNumber(operand, "Unary - operand");
      throw new Error("Unsupported unary operator: " + node.operator);
    }
    if (node.type === "binary") {
      var left = evaluateNode(node.left, vars);
      var right = evaluateNode(node.right, vars);
      return applyBinaryOperator(node.operator, left, right);
    }
    throw new Error("Unsupported expression node: " + node.type);
  }

  // Безопасно вычисляет выражение без eval, Function и доступа к глобальному объекту.
  function evaluateExpression(expression, vars) {
    if (typeof expression !== "string") {
      throw new Error("Expression must be a string");
    }
    return evaluateNode(parseExpression(expression), vars || {});
  }

  // Публикует минимальный общий API для загрузчика, runtime и прямых unit-тестов.
  global.VNExpression = {
    evaluate: evaluateExpression,
    inspect: inspectExpression
  };
})(window);
