"use strict";

import {
    CategoryType,
    d3Selection,
    LegendDataPointExtended,
    LineDataPoint,
    VerticalLineDataItemsGlobalWithKey,
    VisualDataPoint
} from "./visualInterfaces";
import {
    BaseDataPoint,
    IBehaviorOptions,
    IInteractiveBehavior,
    ISelectionHandler
} from "powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService";
import {ITooltipServiceWrapper} from "powerbi-visuals-utils-tooltiputils";
import {LegendBehavior} from "./legendBehavior";
import {IValueFormatter} from "powerbi-visuals-utils-formattingutils/lib/src/valueFormatter";
import {Shapes} from "./settings";
import {Visual} from "./visual";

export interface WebBehaviorOptions extends IBehaviorOptions<BaseDataPoint> {
    selectionLines: LineDataPoint[];
    lineGroupSelection: d3Selection<LineDataPoint>;
    interactiveLineGroupSelection: d3Selection<LineDataPoint>;
    dotsSelection: d3Selection<LineDataPoint>;
    container: d3Selection<any>;
    tooltipServiceWrapper: ITooltipServiceWrapper;
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey;
    legendBehavior: LegendBehavior;
    legendDataPoints: LegendDataPointExtended[];
    legendFormatter: IValueFormatter;
    legendType: CategoryType;
    shapes: Shapes;
}

export class WebBehavior implements IInteractiveBehavior {
//         private dataPoints: VisualDataPoint[];
//         private lineGroupSelection: Update<LineDataPoint>;
//         private interactiveLineGroupSelection: Update<LineDataPoint>;
//         private dotsSelection: Update<LineDataPoint>;
//         private container: Selection<any>;
//         private shapes: shapes;
//         private hasLasso: boolean;
//         private selectionHandler: ISelectionHandler;
//         private legendBehavior: LegendBehavior;
//         private legendFormatter: IValueFormatter;
//         private legendType: CategoryType;

    public bindEvents(
        options: WebBehaviorOptions,
        selectionHandler: ISelectionHandler): void {
//
//                 this.dataPoints = options.dataPoints;
//                 this.lineGroupSelection = options.lineGroupSelection;
//                 this.interactiveLineGroupSelection = options.interactiveLineGroupSelection;
//                 this.dotsSelection = options.dotsSelection;
//                 this.container = options.container;
//                 this.legendBehavior = options.legendBehavior;
//                 this.legendFormatter = options.legendFormatter;
//                 this.legendType = options.legendType;
//                 this.shapes = options.shapes;
//
//                 let retrieveTooltipFromArgument = this.retrieveTooltipFromArgument;
//                 let formatItemWithLegendFormatter = this.formatItemWithLegendFormatter;
//
//                 this.interactiveLineGroupSelection.on("click", (lineDataPoint: LineDataPoint, index: number) => {
//                     options.selectionLines[index].selected = !options.selectionLines[index].selected;
//                     if (options.selectionLines[index].selected) {
//                         let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, options.legendType, options.legendFormatter);
//                         options.legendBehavior.renderLassoSelection([legendName], true, false);
//                         selectionHandler.handleSelection(lineDataPoint, false);
//                         options.legendBehavior.renderLassoSelection([legendName], true, false);
//                     } else {
//                         selectionHandler.handleClearSelection();
//                         options.legendBehavior.renderLassoSelection([], false, false);
//                     }
//                 });
//                 options.tooltipServiceWrapper.addTooltip(options.interactiveLineGroupSelection,
//                     (args: TooltipEventArgs<LineDataPoint>) => {
//                         let tooltips: VisualTooltipDataItem[] = retrieveTooltipFromArgument(args, options.verticalLineDataItemsGlobal);
//                         return tooltips;
//                     },
//                     null,
//                     true);
//
//                 this.dotsSelection.on("click", (lineDataPoint: LineDataPoint, index: number) => {
//                     options.selectionLines[index].selected = !options.selectionLines[index].selected;
//                     if (options.selectionLines[index].selected) {
//                         let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, options.legendType, options.legendFormatter);
//                         options.legendBehavior.renderLassoSelection([legendName], true, false);
//                         selectionHandler.handleSelection(lineDataPoint, false);
//                         options.legendBehavior.renderLassoSelection([legendName], true, false);
//                     } else {
//                         selectionHandler.handleClearSelection();
//                         options.legendBehavior.renderLassoSelection([], false, false);
//                     }
//                 });
//                 options.tooltipServiceWrapper.addTooltip(options.dotsSelection,
//                     (args: TooltipEventArgs<LineDataPoint>) => {
//                         let tooltips: VisualTooltipDataItem[] = retrieveTooltipFromArgument(args, options.verticalLineDataItemsGlobal);
//                         return tooltips;
//                     },
//                     null,
//                     true);
//                 this.selectionHandler = selectionHandler;
//                 this.hasLasso = false;
    }

//         private retrieveTooltipFromArgument(args: TooltipEventArgs<LineDataPoint>, verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey): VisualTooltipDataItem[] {
//             let lineDataPoint: LineDataPoint = args.data;
//             let lineKey: string = lineDataPoint.lineKey.split(lineDataPoint.name)[0];
//             let data: VerticalLineDataItemsGlobal = verticalLineDataItemsGlobal[lineKey];
//             let tooltips: VisualTooltipDataItem[] = null;
//             if (data) {
//                 let hoverLineData: Update<number> = data.hoverLineData;
//                 let verticalLineDataItems: VerticalLineDataItem[] = data.verticalLineDataItems;
//                 let index: number = hoverLineData.data()[0];
//                 tooltips = verticalLineDataItems[index].tooltips;
//             }
//             return tooltips;
//         }
//
//         private formatItemWithLegendFormatter(lineDataPointName: string, legendType: CategoryType, legendFormatter: IValueFormatter) {
//             let item: PrimitiveValue = (legendType == CategoryType.Date) ? new Date(lineDataPointName) : lineDataPointName;
//             let legendName: string = (legendFormatter) ? legendFormatter.format(item) : item.toString();
//             return legendName;
//         }

    public renderSelection(hasSelection: boolean): void {
//             let selectedLegendNames: string[] = [];
//             let legendType: CategoryType = this.legendType;
//             let legendFormatter: IValueFormatter = this.legendFormatter;
//             let formatItemWithLegendFormatter = this.formatItemWithLegendFormatter;
//             let selectedList: string[] = this.legendBehavior.getSelected();
//
//             this.lineGroupSelection.style("opacity", (lineDataPoint: LineDataPoint) => {
//                 let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, legendType, legendFormatter);
//                 let selected: boolean = this.hasLasso ? false : selectedList.indexOf(legendName) != -1;
//                 if (selected && selectedLegendNames.indexOf(legendName) == -1)
//                     selectedLegendNames.push(legendName);
//                 let opacity: number = getOpacity(selected, hasSelection);
//                 let showMarkers: boolean = lineDataPoint.showMarkers != null
//                     ? lineDataPoint.showMarkers
//                     : this.shapes.showMarkers;
//                 let stepped: boolean = lineDataPoint.stepped != null
//                     ? lineDataPoint.stepped
//                     : this.shapes.stepped;
//                 if (showMarkers && stepped) {
//                     let markerPathId = MarkersUtility.retrieveMarkerName(lineDataPoint.lineKey, Visual.MarkerLineSelector.className);
//                     let markers = this.container.select("#" + markerPathId);
//                     markers.style("opacity", opacity);
//                 }
//                 return opacity;
//             });
//             this.dotsSelection.style("opacity", (lineDataPoint: LineDataPoint) => {
//                 let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, legendType, legendFormatter);
//                 let selected: boolean = this.hasLasso ? false : selectedList.indexOf(legendName) != -1;
//                 if (selected && selectedLegendNames.indexOf(legendName) == -1)
//                     selectedLegendNames.push(legendName);
//                 let opacity: number = getOpacity(selected, hasSelection);
//                 return opacity;
//             });
//             if (hasSelection)
//                 this.legendBehavior.renderLassoSelection(selectedLegendNames, hasSelection, false);
    }

//         public renderLassoSelection(hasSelection: boolean): void {
//             this.renderSelection(hasSelection);
//             this.hasLasso = hasSelection;
//         }
//
//         public hasLassoSelection(): boolean {
//             return this.hasLasso;
//         }
//
//         public customLassoSelect(dataPoints: VisualDataPoint[]) {
//             this.selectionHandler.handleClearSelection();
//             this.selectionHandler.handleSelection(dataPoints, false);
//             let selectedLegendNames: string[] = [];
//             for(let i=0;i<dataPoints.length;i++) {
//                 selectedLegendNames.push(dataPoints[i].tooltips[0].displayName);
//             }
//             this.legendBehavior.renderLassoSelection(selectedLegendNames, true, false);
//         }
//
//         public clearCather() {
//             this.selectionHandler.handleClearSelection();
//             this.legendBehavior.renderLassoSelection([], false, false);
//         }
}

//     export function getOpacity(selected: boolean, hasSelection: boolean): number {
//         if (!selected && hasSelection) {
//             return DimmedOpacity;
//         }
//         return DefaultOpacity;
//     }
// }
