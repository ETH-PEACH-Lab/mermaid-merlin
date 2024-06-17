grammar TestSlidesDiagram
import "../common/common"

entry TestSlidesDiagram:
  NEWLINE*
  "testslides" NEWLINE*
  ( TitleAndAccessibilities )?
  pages+=TestSlide+
;

TestSlide:
  "array" NEWLINE*
  (showIndex="showIndex" NEWLINE*)?
  (
    TitleAndAccessibilities elements+=ArrayElement*
    | NEWLINE+ elements+=ArrayElement+
    | NEWLINE*
  )
;

ArrayElement:
  '@' value=Value (':' arrow='arrow' ('::' context=ID)?)? ( '&' color=Color '&' )? NEWLINE
;

Value returns string:
  INT | ID
;

Color returns string:
  'blue' | 'red' | 'green'
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
