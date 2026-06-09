import type { WidgetView } from "../view.js";
import { TextView } from "./text/index.js";
import { NumberView } from "./number/index.js";
import { SliderView } from "./slider/index.js";
import { CodeView } from "./code/lazy.js";
import { TableView } from "./table/lazy.js";
import { ChartView } from "./chart/lazy.js";
import { DropdownView } from "./dropdown/index.js";
import { CheckboxView } from "./checkbox/index.js";
import { CheckboxGroupView } from "./checkbox-group/index.js";
import { RadioView } from "./radio/index.js";
import { GalleryView } from "./gallery/index.js";
import { VideoView } from "./video/index.js";
import { LabelView } from "./label/index.js";
import { HighlightedTextView } from "./highlighted-text/index.js";
import { AnnotatedImageView } from "./annotated-image/index.js";
import { FileView } from "./file/index.js";
import { ProgressView } from "./progress/index.js";
import { HtmlView } from "./html/index.js";
import { UploadView } from "./upload/index.js";
import { ImageView } from "./image/index.js";
import { ButtonView } from "./button/index.js";
import { MicView } from "./mic/index.js";
import { ChatView } from "./chat/index.js";
import { OutputView } from "./output/index.js";
import { JsonView } from "./json/index.js";
import { LogView } from "./log/index.js";
import { AudioView } from "./audio/index.js";
import { WebcamView } from "./webcam/index.js";
import { LayoutView } from "./layout/index.js";
import { TabsView } from "./tabs/index.js";
import { AccordionView } from "./accordion/index.js";

// the only place that maps a widget's `type` to its React view
export const VIEWS: Record<string, WidgetView> = {
  text: TextView,
  number: NumberView,
  slider: SliderView,
  code: CodeView,
  table: TableView,
  chart: ChartView,
  dropdown: DropdownView,
  checkbox: CheckboxView,
  checkboxGroup: CheckboxGroupView,
  radio: RadioView,
  gallery: GalleryView,
  video: VideoView,
  label: LabelView,
  highlightedText: HighlightedTextView,
  annotatedImage: AnnotatedImageView,
  file: FileView,
  progress: ProgressView,
  html: HtmlView,
  upload: UploadView,
  image: ImageView,
  button: ButtonView,
  mic: MicView,
  chat: ChatView,
  output: OutputView,
  json: JsonView,
  log: LogView,
  audio: AudioView,
  webcam: WebcamView,
  row: LayoutView,
  col: LayoutView,
  grid: LayoutView,
  tabs: TabsView,
  accordion: AccordionView,
};
