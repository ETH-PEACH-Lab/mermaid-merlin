grammar ArrayDiagram
import "../common/common"

entry ArrayDiagram:
  NEWLINE*
  "array"
  (
    NEWLINE* TitleAndAccessibilities elements+=ArrayElement*
    | NEWLINE+ elements+=ArrayElement+
    | NEWLINE*
  )
;

ArrayElement:
  value=INT NEWLINE
;

terminal INT returns number: /0|[1-9][0-9]*/;