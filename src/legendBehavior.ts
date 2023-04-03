'use strict';

import {
    IInteractiveBehavior,
    ISelectionHandler,
} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';

import {d3Selection} from './visualInterfaces';
import {LegendSettings} from './settings';
import {
    calculateItemWidth,
    drawCustomLegendIcons,
    generateLegendItemsForLeftOrRightClick,
} from './utilities/legendUtility';
import {LegendDataPoint} from 'powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces';
import {MarkersUtility} from './utilities/markersUtility';
import {BaseType, select as d3select, selectAll as d3selectAll, Selection} from 'd3-selection';
import {
    ScrollableLegend,
    ScrollableLegendBehaviorOptions,
    ScrollableLegendDataPoint,
} from './utilities/scrollableLegend';
import powerbi from 'powerbi-visuals-api';
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import {SeriesMarkerShape} from './seriesMarkerShape';
import {manipulation as svgManipulation} from 'powerbi-visuals-utils-svgutils';
import {LegendIconType} from './legendIconType';

export class LegendBehavior implements IInteractiveBehavior {
    public static readonly dimmedLegendColor: string = '#A6A6A6';
    public static readonly dimmedLegendMarkerSuffix: string = 'grey';
    public static readonly legendMarkerSuffix: string = 'legend';

    private static readonly MarkerLineLength = 30;

    private clearCatcher: d3Selection<any>;
    private selectionHandler: ISelectionHandler;

    private legendItems: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    private legendIcons: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    private legendItemLines: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;

    private legendSettings: LegendSettings;
    private dataPoints: ScrollableLegendDataPoint[];
    private markerIds: string[];
    private selectedLegendNames: string[];
    private itemWidth: number;

    constructor() {
        this.selectedLegendNames = [];
    }

    public addLegendData(legendSettings: LegendSettings, dataPoints: ScrollableLegendDataPoint[]): void {
        this.legendSettings = legendSettings;
        this.dataPoints = dataPoints;
        if (dataPoints.length < 2)
            return;
        this.itemWidth = calculateItemWidth(this.legendSettings, this.dataPoints);
    }

    // public leftOrRightClick(isLeft: boolean, legendBehavior: LegendBehavior) {
    //     const legendItems: d3Selection<any> = generateLegendItemsForLeftOrRightClick(this.legendItems, this.dataPoints, this.itemWidth, isLeft);
    //     if (legendItems) {
    //         const data = legendItems.data();
    //         const legendGroup: d3Selection<any> = d3select(legendItems.node().parentElement);
    //         const legendIcons: d3Selection<any> = legendGroup.selectAll('circle').data(data);
    //         const newOptions: ScrollableLegendBehaviorOptions = {
    //             // legendItems: legendItems,
    //             // legendIcons: legendIcons,
    //             // clearCatcher: this.clearCatcher,
    //             behavior: this,
    //             dataPoints: this.dataPoints,
    //         };
    //         legendBehavior.bindEvents(newOptions, this.selectionHandler);
    //     }
    // }

    public bindEvents(options: ScrollableLegendBehaviorOptions, selectionHandler: ISelectionHandler): void {
        console.log('bindEvents');
        console.log(options);
        this.legendItems = options.legendItems;
        this.legendIcons = options.legendIcons;
        this.legendItemLines = options.legendItemLines;
        this.clearCatcher = options.clearCatcher;
        this.selectionHandler = selectionHandler;

        // this.appendLegendFontFamily();
        // if (this.legendSettings && this.dataPoints) {
        // drawCustomLegendIcons(this.legendItems, this.legendSettings, this.dataPoints);
        // }

        // const setCustomLegendIcon = this.setCustomLegendIcon;

        options.legendItems.on('click', (e: MouseEvent, d: LegendDataPoint) => {
            console.log('click');
            const multiSelect: boolean = e.ctrlKey;
            const index: number = this.selectedLegendNames.indexOf(d.label);
            if (index == -1) {
                if (multiSelect)
                    this.selectedLegendNames.push(d.label);
                else
                    this.selectedLegendNames = [d.label];
            } else {
                const ar1: string[] = this.selectedLegendNames.slice(0, index);
                const ar2: string[] = this.selectedLegendNames.slice(index + 1, this.selectedLegendNames.length);
                this.selectedLegendNames = ar1.concat(ar2);
            }

            if (this.selectedLegendNames.length == 0) {
                selectionHandler.handleClearSelection();
            } else {
                selectionHandler.handleSelection(d, multiSelect);
            }
        });

        const markers: d3Selection<any> = d3selectAll('svg.legend  marker');
        const markersLen: number = markers && markers.size() > 0 ? markers.size() : 0;
        this.markerIds = [];
        for (let i = 0; i < markersLen; i++) {
            const item = markers.nodes()[i];
            const marker: d3Selection<any> = d3select(item);
            const markerId: string = marker.attr('id');
            this.markerIds.push(markerId);
        }

        const markerIds: string[] = this.markerIds;

        options.clearCatcher.on('click', () => {
            console.log('clear catcher click');
            selectionHandler.handleClearSelection();
            // TODO Fix reset dimmed elements
            // const legendItems: d3Selection<LegendDataPoint> = this.legendItems;
            // options.legendIcons.each((d: LegendDataPoint, index: number) => {
            //     const item: d3Selection<any> = d3select(legendItems.nodes()[index]);
            //     // setCustomLegendIcon(item, d.color, d.label, markerIds);
            // });
        });
    }

    // private setCustomLegendIcon(item: d3Selection<any>, fill: string, label: string, markerIds: string[]) {
    //     console.log('setCustomLegendIcon');
    //     console.log(item);
    //
    //     item.select('.legend-item-line')
    //         .style('fill', fill)
    //         .style('stroke', fill);
    //
    //     console.log(item.data()[0].tooltip);
    //
    //     const itemLegendMarker: d3Selection<LegendDataPoint> = item.select('.legend-item-marker');
    //     // let markerId: string = itemLegendMarker && itemLegendMarker.size() > 0 && itemLegendMarker.nodes()[0] ? itemLegendMarker.style('marker-start') : null;
    //     // console.log(itemLegendMarker);
    //     // console.log(markerId);
    //     // if (markerId) {
    //     //     const labelText: string = MarkersUtility.retrieveMarkerName(label + LegendBehavior.legendMarkerSuffix, '');
    //     //     console.log(labelText);
    //     //     for (let i = 0; i < markerIds.length; i++) {
    //     //         const item: string = markerIds[i];
    //     //         if (item.indexOf(labelText) != -1) {
    //     //             const markerNotSelected: boolean = item.indexOf(LegendBehavior.dimmedLegendMarkerSuffix) != -1;
    //     //             const isNotSelected = fill == LegendBehavior.dimmedLegendColor;
    //     //             if (markerNotSelected == isNotSelected) {
    //     //                 markerId = item;
    //     //                 break;
    //     //             }
    //     //         }
    //     //     }
    //     //     itemLegendMarker.style('marker-start', 'url(#' + markerId + ')');
    //     // }
    // }

    public renderSelection(hasSelection: boolean): void {
        console.log('renderSelection');
        this.renderLassoSelection(this.selectedLegendNames, hasSelection, false);
    }

    // private appendLegendFontFamily() {
    // const fontFamily: string = this.legendSettings.fontFamily;
    // this.legendItems.selectAll('.legendText').style('font-family', fontFamily);
    // d3select('svg.legend .legendTitle').style('font-family', fontFamily);
    // }

    public getSelected(): string[] {
        return this.selectedLegendNames;
    }

    public renderLassoSelection(selectedLegendNames: string[], hasSelection: boolean, multiSelect: boolean) {
        if (!selectedLegendNames)
            selectedLegendNames = [];
        if (multiSelect) {
            selectedLegendNames = selectedLegendNames.concat(this.selectedLegendNames);
        }

        this.selectedLegendNames = selectedLegendNames;

        this.legendIcons
            .attr('transform', (dataPoint) => {
                return svgManipulation.translateAndScale(dataPoint.glyphPosition.x, dataPoint.glyphPosition.y, ScrollableLegend.getIconScale(dataPoint.seriesMarkerShape));
            })
            .attr('d', (dataPoint) => {
                return MarkersUtility.getPath(dataPoint.seriesMarkerShape || SeriesMarkerShape.circle);
            })
            .attr('stroke-width', (dataPoint) => {
                // if (dataPoint.lineStyle) {
                //     return 2;
                // }
                return MarkersUtility.getStrokeWidth(dataPoint.seriesMarkerShape || SeriesMarkerShape.circle);
            })
            .style('fill', (d) => {
                if (d.lineStyle) {
                    return null;
                }

                return !hasSelection || d.selected ? d.color : LegendBehavior.dimmedLegendColor;
            })
            .style('stroke', (dataPoint) => dataPoint.color)
            .style('stroke-dasharray', (dataPoint) => {
                if (dataPoint.lineStyle) {
                    return ScrollableLegend.getStrokeDashArrayForLegend(dataPoint.lineStyle);
                }
                return null;
            });

        this.legendItemLines
            .attr('transform', (dataPoint) => {
                return svgManipulation.translateAndScale(dataPoint.glyphPosition.x, dataPoint.glyphPosition.y, ScrollableLegend.getIconScale(dataPoint.seriesMarkerShape));
            })
            .attr('d', (d) => {
                const padding: number = this.legendSettings.fontSize / 4;
                // const lineStart: number = -ScrollableLegend.MarkerLineLength - padding;
                // const lineEnd: number = -padding;
                const lineStart = -padding;
                const lineEnd = -padding + LegendBehavior.MarkerLineLength;
                return 'M' + lineStart + ',0L' + lineEnd + ',0';
            })
            .attr('stroke-width', '2')
            .style('fill', (d) => d.color)
            .style('stroke', (d) => d.color)
            .style('opacity', (d) => d.legendIconType == LegendIconType.lineMarkers || d.legendIconType == LegendIconType.line ? 1.0 : 0.0);

        // TODO Fix render selection dim not selected elements

        // const legendItems: d3Selection<LegendDataPoint> = this.legendItems;
        // const markerIds: string[] = this.markerIds;
        // const setCustomLegendIcon = this.setCustomLegendIcon;
        // this.legendIcons.style('fill', (d: LegendDataPoint, index: number) => {
        //     console.log(d);
        //
        //     let fill: string = d.color;
        //     if (hasSelection && selectedLegendNames.length > 0) {
        //         const isSelected: boolean = selectedLegendNames.indexOf(d.label) != -1;
        //         d.selected = multiSelect
        //             ? (isSelected ? true : d.selected)
        //             : isSelected;
        //         fill = (d.selected)
        //             ? d.color
        //             : LegendBehavior.dimmedLegendColor;
        //     } else {
        //         d.selected = false;
        //     }
        //     const item: d3Selection<any> = d3select(legendItems.nodes()[index]);
        //     // setCustomLegendIcon(item, fill, d.tooltip, markerIds);
        //     return fill;
        // });
    }
}
