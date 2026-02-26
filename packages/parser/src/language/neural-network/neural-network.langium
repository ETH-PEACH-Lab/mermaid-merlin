grammar NeuralNetwork
import "../common/common"

entry NeuralNetworkDiagram:
  NEWLINE*
  "neural-network" NEWLINE*
  ((showWeights?="showWeights" | showLabels?="showLabels" (':' top='top')? (':' bottom='bottom')? | showArrowheads?="showArrowheads" | showBias?="showBias") NEWLINE*)*

  (
    TitleAndAccessibilities elements+=NeuralNetworkElement*
    | NEWLINE+ elements+=NeuralNetworkElement+
    | NEWLINE*
  )
;

NeuralNetworkElement:
  '@' layer=ID ('&' layerColor=Color '&')? items+=NeuralNetworkItem+ NEWLINE*
;

NeuralNetworkItem:
  value=Value
  ('&' color=Color '&')?
;

Value returns string:
  INT | ID
;

Color returns string:
  'blue' | 'red' | 'green'
;

terminal INT returns number: /0|[1-9][0-9]*/;
terminal ID: /[a-zA-Z_][a-zA-Z0-9_]*/;
