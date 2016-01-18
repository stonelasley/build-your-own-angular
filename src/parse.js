'use strict';

var _ = require('lodash');

function parse(expr) {

  var lexer = new Lexer();
  var parser = new Parser(lexer);
  return parser.parse(expr);
}

function AST(lexer) {

  this.lexer = lexer;
}

AST.Literal = 'Literal';
AST.Program = 'Program';

function ASTCompiler(astBuilder) {

  this.astBuilder = astBuilder;
}

function Lexer() {

}

function Parser(lexer) {

  this.lexer = lexer;
  this.ast = new AST(this.lexer);
  this.astCompiler = new ASTCompiler(this.ast);
}

AST.prototype.ast = function (text) {

  this.tokens = this.lexer.lex(text);
  return this.program();
};

AST.prototype.constant = function () {

  return {type: AST.Literal, value: this.tokens[0].value};
};

AST.prototype.program = function () {
  return {type: AST.Program, body: this.constant()};
};

ASTCompiler.prototype.compile = function (text) {

  var ast = this.astBuilder.ast(text);
  this.state = {body: []};
  this.recurse(ast);

  /* jshint -W054 */
  return new Function(this.state.body.join(''));
  /* jshint +W054 */
};

ASTCompiler.prototype.escape = function (value) {

  if (_.isString(value)) {
    return '\'' + value + '\'';
  } else {
    return value;
  }
};

ASTCompiler.prototype.recurse = function (ast) {

  switch (ast.type) {

    case AST.Program:
      this.state.body.push('return ', this.recurse(ast.body), ';');
      break;
    case AST.Literal:
      return this.escape(ast.value);
  }
};

Lexer.prototype.isExpOperator = function (ch) {
  return ch === '-' || ch === '+' || this.isNumber(ch);
};

Lexer.prototype.isNumber = function (ch) {

  return '0' <= ch && ch <= '9';
};

Lexer.prototype.lex = function (text) {

  this.text = text;
  this.index = 0;
  this.ch = undefined;
  this.tokens = [];

  while (this.index < this.text.length) {

    this.ch = this.text.charAt(this.index);
    if (this.isNumber(this.ch) ||
      (this.ch === '.' && this.isNumber(this.peek()))) {

      this.readNumber();
    } else if (this.ch === '\'' || this.ch === '"') {

      this.readString(this.ch);
    } else {

      throw 'Unexpected next character: ' + this.ch;
    }
  }

  return this.tokens;
};

Lexer.prototype.peek = function () {

  return this.index < this.text.length - 1 ?
    this.text.charAt(this.index + 1) :
    false;
};

Lexer.prototype.readNumber = function () {

  var number = '';

  while (this.index < this.text.length) {

    var ch = this.text.charAt(this.index).toLowerCase();
    if (ch === '.' || this.isNumber(ch)) {

      number += ch;
    } else {

      var nextCh = this.peek();
      var prevCh = number.charAt(number.length - 1);
      if (ch === 'e' && this.isExpOperator(nextCh)) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' &&
        (nextCh && this.isNumber(nextCh))) {
        number += ch;
      } else if (this.isExpOperator(ch) && prevCh === 'e' &&
        (!nextCh || !this.isNumber(nextCh))) {
        throw "Invalid exponent";
      } else {
        break;
      }
    }
    this.index++;
  }

  this.tokens.push({
    text: number,
    value: Number(number)
  });
};

Lexer.prototype.readString = function (quote) {

  this.index++;
  var string = '';
  while (this.index < this.text.length) {

    var ch = this.text.charAt(this.index);

    if (ch === quote) {
      this.index++;
      this.tokens.push({
        text: string,
        value: string
      });
      return;
    } else {
      string += ch;
    }

    this.index++;
  }
  throw 'Unmatched quote';
};

Parser.prototype.parse = function (text) {

  return this.astCompiler.compile(text);
};

module.exports = parse;