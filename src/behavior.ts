"use strict";

import {
    CategoryType,
    d3Selection,
    LineDataPoint, VerticalLineDataItem, VerticalLineDataItemsGlobal,
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
import {DefaultOpacity, DimmedOpacity, Shapes} from "./settings";
import {Visual} from "./visual";
import {local as d3local} from "d3-selection";
import powerbi from "powerbi-visuals-api";
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import PrimitiveValue = powerbi.PrimitiveValue;
import {MarkersUtility} from "./utilities/markersUtility";
import {ScrollableLegendDataPoint} from './utilities/scrollableLegend';

export interface WebBehaviorOptions extends IBehaviorOptions<BaseDataPoint> {
    selectionLines: LineDataPoint[];
    lineGroupSelection: d3Selection<LineDataPoint>;
    interactiveLineGroupSelection: d3Selection<LineDataPoint>;
    dotsSelection: d3Selection<LineDataPoint>;
    container: d3Selection<any>;
    tooltipServiceWrapper: ITooltipServiceWrapper;
    verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey;
    legendBehavior: LegendBehavior;
    legendDataPoints: ScrollableLegendDataPoint[];
    legendFormatter: IValueFormatter;
    legendType: CategoryType;
    shapes: Shapes;
}

export class WebBehavior implements IInteractiveBehavior {
    private dataPoints: VisualDataPoint[];
    private lineGroupSelection: d3Selection<LineDataPoint>;
    private interactiveLineGroupSelection: d3Selection<LineDataPoint>;
    private dotsSelection: d3Selection<LineDataPoint>;
    private container: d3Selection<any>;
    private shapes: Shapes;
    private hasLasso: boolean;
    private selectionHandler: ISelectionHandler;
    private legendBehavior: LegendBehavior;
    private legendFormatter: IValueFormatter;
    private legendType: CategoryType;

    public bindEvents(
        options: WebBehaviorOptions,
        selectionHandler: ISelectionHandler): void {

        this.dataPoints = options.dataPoints as VisualDataPoint[];
        this.lineGroupSelection = options.lineGroupSelection;
        this.interactiveLineGroupSelection = options.interactiveLineGroupSelection;
        this.dotsSelection = options.dotsSelection;
        this.container = options.container;
        this.legendBehavior = options.legendBehavior;
        this.legendFormatter = options.legendFormatter;
        this.legendType = options.legendType;
        this.shapes = options.shapes;

        const retrieveTooltipFromArgument = this.retrieveTooltipFromArgument;
        const formatItemWithLegendFormatter = this.formatItemWithLegendFormatter;

        // const indicesLineGroupSelection = d3local<number>();
        // this.interactiveLineGroupSelection
        //     .each(function (d, i) {
        //         indicesLineGroupSelection.set(this, i)
        //     })
        //     .on("click", function (_, lineDataPoint) {
        //         const index = indicesLineGroupSelection.get(this);
        //         options.selectionLines[index].selected = !options.selectionLines[index].selected;
        //         if (options.selectionLines[index].selected) {
        //             const legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, options.legendType, options.legendFormatter);
        //             options.legendBehavior.renderLassoSelection([legendName], true, false);
        //             selectionHandler.handleSelection(lineDataPoint, false);
        //             options.legendBehavior.renderLassoSelection([legendName], true, false);
        //         } else {
        //             selectionHandler.handleClearSelection();
        //             options.legendBehavior.renderLassoSelection([], false, false);
        //         }
        //     });
        options.tooltipServiceWrapper.addTooltip(options.interactiveLineGroupSelection,
            (lineDataPoint: LineDataPoint) => {
                const tooltips: VisualTooltipDataItem[] = retrieveTooltipFromArgument(lineDataPoint, options.verticalLineDataItemsGlobal);
                return tooltips;
            },
            null,
            true);

        // const indicesDotsSelection = d3local<number>();
        // this.dotsSelection
        //     .each(function (d, i) {
        //         indicesDotsSelection.set(this, i);
        //     })
        //     .on("click", function (_, lineDataPoint: LineDataPoint) {
        //         const index = indicesDotsSelection.get(this);
        //         options.selectionLines[index].selected = !options.selectionLines[index].selected;
        //         if (options.selectionLines[index].selected) {
        //             const legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, options.legendType, options.legendFormatter);
        //             options.legendBehavior.renderLassoSelection([legendName], true, false);
        //             selectionHandler.handleSelection(lineDataPoint, false);
        //             options.legendBehavior.renderLassoSelection([legendName], true, false);
        //         } else {
        //             selectionHandler.handleClearSelection();
        //             options.legendBehavior.renderLassoSelection([], false, false);
        //         }
        //     });
        options.tooltipServiceWrapper.addTooltip(options.dotsSelection,
            (lineDataPoint: LineDataPoint) => {
                const tooltips: VisualTooltipDataItem[] = retrieveTooltipFromArgument(lineDataPoint, options.verticalLineDataItemsGlobal);
                return tooltips;
            },
            null,
            true);
        this.selectionHandler = selectionHandler;
        this.hasLasso = false;
    }

    private retrieveTooltipFromArgument(lineDataPoint: LineDataPoint, verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey): VisualTooltipDataItem[] {
        const lineKey: string = lineDataPoint.lineKey.split(lineDataPoint.name)[0];
        const data: VerticalLineDataItemsGlobal = verticalLineDataItemsGlobal[lineKey];
        let tooltips: VisualTooltipDataItem[] = null;
        if (data) {
            const hoverLineData: d3Selection<number> = data.hoverLineData;
            const verticalLineDataItems: VerticalLineDataItem[] = data.verticalLineDataItems;
            const index: number = hoverLineData.data()[0];
            tooltips = verticalLineDataItems[index].tooltips;
        }
        return tooltips;
    }

    private formatItemWithLegendFormatter(lineDataPointName: string, legendType: CategoryType, legendFormatter: IValueFormatter) {
        const item: PrimitiveValue = (legendType == CategoryType.Date) ? new Date(lineDataPointName) : lineDataPointName;
        const legendName: string = (legendFormatter) ? legendFormatter.format(item) : item.toString();
        return legendName;
    }

    public renderSelection(hasSelection: boolean): void {
        // let selectedLegendNames: string[] = [];
        // let legendType: CategoryType = this.legendType;
        // let legendFormatter: IValueFormatter = this.legendFormatter;
        // let formatItemWithLegendFormatter = this.formatItemWithLegendFormatter;
        // let selectedList: string[] = this.legendBehavior.getSelected();
        //
        // this.lineGroupSelection.style("opacity", (lineDataPoint: LineDataPoint) => {
        //     let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, legendType, legendFormatter);
        //     let selected: boolean = this.hasLasso ? false : selectedList.indexOf(legendName) != -1;
        //     if (selected && selectedLegendNames.indexOf(legendName) == -1)
        //         selectedLegendNames.push(legendName);
        //     let opacity: number = getOpacity(selected, hasSelection);
        //     let showMarkers: boolean = lineDataPoint.showMarkers != null
        //         ? lineDataPoint.showMarkers
        //         : this.shapes.showMarkers;
        //     let stepped: boolean = lineDataPoint.stepped != null
        //         ? lineDataPoint.stepped
        //         : this.shapes.stepped;
        //     if (showMarkers && stepped) {
        //         let markerPathId = MarkersUtility.retrieveMarkerName(lineDataPoint.lineKey, Visual.MarkerLineSelector.className);
        //         let markers = this.container.select("#" + markerPathId);
        //         markers.style("opacity", opacity);
        //     }
        //     return opacity;
        // });
        // this.dotsSelection.style("opacity", (lineDataPoint: LineDataPoint) => {
        //     let legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, legendType, legendFormatter);
        //     let selected: boolean = this.hasLasso ? false : selectedList.indexOf(legendName) != -1;
        //     if (selected && selectedLegendNames.indexOf(legendName) == -1)
        //         selectedLegendNames.push(legendName);
        //     let opacity: number = getOpacity(selected, hasSelection);
        //     return opacity;
        // });
        // if (hasSelection)
        //     this.legendBehavior.renderLassoSelection(selectedLegendNames, hasSelection, false);
    }

    public renderLassoSelection(hasSelection: boolean): void {
        this.renderSelection(hasSelection);
        this.hasLasso = hasSelection;
    }

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

    public clearCather() {
        this.selectionHandler.handleClearSelection();
        this.legendBehavior.renderLassoSelection([], false, false);
    }
}

export function getOpacity(selected: boolean, hasSelection: boolean): number {
    if (!selected && hasSelection) {
        return DimmedOpacity;
    }
    return DefaultOpacity;
}
