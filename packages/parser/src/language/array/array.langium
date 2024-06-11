grammar ArrayDiagram
import "../common/common"

entry ArrayDiagram:
  NEWLINE*
  "array" NEWLINE*
  (showIndex="showIndex" NEWLINE*)?
  (
    TitleAndAccessibilities elements+=ArrayElement*
    | NEWLINE+ elements+=ArrayElement+
    | NEWLINE*
  )
;

ArrayElement:
  '@' value=Value NEWLINE
;

Value returns string:
  INT | ID
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
