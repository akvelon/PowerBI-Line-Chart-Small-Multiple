'use strict';

import {
    CategoryType,
    d3Selection,
    LineDataPoint,
    VerticalLineDataItem,
    VerticalLineDataItemsGlobal,
    VerticalLineDataItemsGlobalWithKey,
    VisualDataPoint,
} from './visualInterfaces';
import {
    BaseDataPoint,
    IBehaviorOptions,
    IInteractiveBehavior,
    ISelectionHandler,
} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {ITooltipServiceWrapper} from 'powerbi-visuals-utils-tooltiputils';
import {LegendBehavior} from './legendBehavior';
import {IValueFormatter} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {DefaultOpacity, DimmedOpacity, Shapes} from './settings';
import powerbi from 'powerbi-visuals-api';
import {ScrollableLegendDataPoint} from './utilities/scrollableLegend';
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import PrimitiveValue = powerbi.PrimitiveValue;

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
    legendFormatter: IValueFormatter | null;
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
    private legendFormatter: IValueFormatter | null;
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
                return retrieveTooltipFromArgument(lineDataPoint, options.verticalLineDataItemsGlobal);
            },
            undefined,
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
                return retrieveTooltipFromArgument(lineDataPoint, options.verticalLineDataItemsGlobal);
            },
            undefined,
            true);
        this.selectionHandler = selectionHandler;
        this.hasLasso = false;
    }

    private retrieveTooltipFromArgument(lineDataPoint: LineDataPoint, verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey): VisualTooltipDataItem[] {
        const lineKey: string = lineDataPoint.lineKey.split(lineDataPoint.name)[0];
        const data: VerticalLineDataItemsGlobal = verticalLineDataItemsGlobal[lineKey];
        let tooltips: VisualTooltipDataItem[] = [];
        if (data) {
            const hoverLineData: d3Selection<number> = data.hoverLineData;
            const verticalLineDataItems: VerticalLineDataItem[] = data.verticalLineDataItems;
            const index: number = hoverLineData.data()[0];
            tooltips = verticalLineDataItems[index].tooltips;
        }

        return tooltips;
    }

    private formatItemWithLegendFormatter(lineDataPointName: string, legendType: CategoryType, legendFormatter: IValueFormatter | null) {
        const item: PrimitiveValue = (legendType == CategoryType.Date) ? new Date(lineDataPointName) : lineDataPointName;
        return (legendFormatter) ? legendFormatter.format(item) : item.toString();
    }

    public renderSelection(hasSelection: boolean): void {
        const selectedLegendNames: string[] = [];
        const legendType = this.legendType;
        const legendFormatter = this.legendFormatter;
        const formatItemWithLegendFormatter = this.formatItemWithLegendFormatter;
        const selectedList: string[] = this.legendBehavior.getSelected();

        const getSelectionOpacity = (lineDataPoint: LineDataPoint) => {
            const legendName: string = formatItemWithLegendFormatter(lineDataPoint.name, legendType, legendFormatter);
            const selected: boolean = this.hasLasso ? false : selectedList.indexOf(legendName) != -1;
            if (selected && selectedLegendNames.indexOf(legendName) == -1)
                selectedLegendNames.push(legendName);
            return getOpacity(selected, hasSelection);
        };

        this.lineGroupSelection.style('opacity', (lineDataPoint: LineDataPoint) => {
            const opacity: number = getSelectionOpacity(lineDataPoint);
            const showMarkers: boolean = lineDataPoint.showMarkers != null
                ? lineDataPoint.showMarkers
                : this.shapes.showMarkers;
            const stepped: boolean = lineDataPoint.stepped != null
                ? lineDataPoint.stepped
                : this.shapes.stepped;
            // if (showMarkers && stepped) {
            //     const markerPathId = MarkersUtility.retrieveMarkerName(lineDataPoint.lineKey, Visual.MarkerLineSelector.className);
            //     const markers = this.container.select("#" + markerPathId);
            //     markers.style("opacity", opacity);
            // }
            return opacity;
        });
        this.dotsSelection.style('opacity', getSelectionOpacity);
        if (hasSelection)
            this.legendBehavior.renderLassoSelection(selectedLegendNames, hasSelection, false);
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
