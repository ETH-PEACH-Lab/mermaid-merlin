grammar MatrixDiagram
import "../common/common"

entry MatrixDiagram:
  NEWLINE*
  "matrix" NEWLINE*
  (showIndex="showIndex" NEWLINE*)?
  (
    TitleAndAccessibilities rows+=MatrixRow*
    | NEWLINE+ rows+=MatrixRow+
    | NEWLINE*
  )
  "@" NEWLINE*
  rows+=MatrixRow+
  "@" NEWLINE*
;

MatrixRow:
  elements+=MatrixElement ("," elements+=MatrixElement)* NEWLINE
;

MatrixElement:
  value=Value ( "{" color=Color "}" )?
;

Value returns string:
  INT | ID
;

Color returns string:
  'blue' | 'green' | 'red'
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
