"use strict";

import {
    IInteractiveBehavior,
    ISelectionHandler
} from "powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService";

import {d3Selection, LegendBehaviorOptions, LegendDataPointExtended} from "./visualInterfaces";
import {LegendSettings} from "./settings";
import {
    calculateItemWidth,
    drawCustomLegendIcons,
    generateLegendItemsForLeftOrRightClick
} from "./utilities/legendUtility";
import {LegendDataPoint} from "powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces";
import {MarkersUtility} from "./utilities/markersUtility";
import {select as d3select, selectAll as d3selectAll} from "d3-selection";

export class LegendBehavior implements IInteractiveBehavior {
    public static dimmedLegendColor: string = "#A6A6A6";
    public static dimmedLegendMarkerSuffix: string = "grey";
    public static legendMarkerSuffix: string = "legend";

    private static clearCatcher: d3Selection<any>;
    private static selectionHandler: ISelectionHandler;

    private legendItems: d3Selection<any>;
    private legendIcons: d3Selection<any>;

    private legendSettings: LegendSettings;
    private dataPoints: LegendDataPointExtended[];
    private markerIds: string[];
    private selectedLegendNames: string[];
    private itemWidth: number;

    constructor() {
        this.selectedLegendNames = [];
    }

    public addLegendData(legendSettings: LegendSettings, dataPoints: LegendDataPointExtended[]): void {
        this.legendSettings = legendSettings;
        this.dataPoints = dataPoints;
        if (dataPoints.length < 2)
            return;
        this.itemWidth = calculateItemWidth(this.legendSettings, this.dataPoints);
    }

    public leftOrRightClick(isLeft: boolean, legendBehavior: LegendBehavior) {
        let legendItems: d3Selection<any> = generateLegendItemsForLeftOrRightClick(this.legendItems, this.dataPoints, this.itemWidth, isLeft);
        if (legendItems) {
            let data = legendItems.data();
            let legendGroup: d3Selection<any> = d3select(legendItems.node().parentElement);
            let legendIcons: d3Selection<any> = legendGroup.selectAll('circle').data(data);
            let newOptions: LegendBehaviorOptions = {
                legendItems: legendItems,
                legendIcons: legendIcons,
                clearCatcher: LegendBehavior.clearCatcher,
                behavior: this,
                dataPoints: this.dataPoints,
            }
            legendBehavior.bindEvents(newOptions, LegendBehavior.selectionHandler);
        }
    }

    public bindEvents(options: LegendBehaviorOptions, selectionHandler: ISelectionHandler): void {
        this.legendItems = options.legendItems;
        this.legendIcons = options.legendIcons;
        LegendBehavior.clearCatcher = options.clearCatcher;
        LegendBehavior.selectionHandler = selectionHandler;

        this.appendLegendFontFamily();
        if (this.legendSettings && this.dataPoints) {
            drawCustomLegendIcons(this.legendItems, this.legendSettings, this.dataPoints);
        }

        let setCustomLegendIcon = this.setCustomLegendIcon;

        options.legendItems.on("click", (e: MouseEvent, d: LegendDataPoint) => {
            let multiSelect: boolean = e.ctrlKey;
            let index: number = this.selectedLegendNames.indexOf(d.label);
            if (index == -1) {
                if (multiSelect)
                    this.selectedLegendNames.push(d.label);
                else
                    this.selectedLegendNames = [d.label];
            } else {
                let ar1: string[] = this.selectedLegendNames.slice(0, index);
                let ar2: string[] = this.selectedLegendNames.slice(index + 1, this.selectedLegendNames.length);
                this.selectedLegendNames = ar1.concat(ar2);
            }
            if (this.selectedLegendNames.length == 0) {
                selectionHandler.handleClearSelection();
            } else {
                selectionHandler.handleSelection(d, multiSelect);
            }
        });

        let markers: d3Selection<any> = d3selectAll('svg.legend  marker');
        let markersLen: number = markers && markers.size() > 0 ? markers.size() : 0;
        this.markerIds = [];
        for (let i = 0; i < markersLen; i++) {
            let item = markers.nodes()[i];
            let marker: d3Selection<any> = d3select(item);
            let markerId: string = marker.attr('id');
            this.markerIds.push(markerId);
        }

        let markerIds: string[] = this.markerIds;

        options.clearCatcher.on("click", () => {
            selectionHandler.handleClearSelection();
            let legendItems: d3Selection<LegendDataPoint> = this.legendItems;
            options.legendIcons.each((d: LegendDataPoint, index: number) => {
                let item: d3Selection<any> = d3select(legendItems.nodes()[index]);
                setCustomLegendIcon(item, d.color, d.label, markerIds);
            });
        });
    }

    private setCustomLegendIcon(item: d3Selection<any>, fill: string, label: string, markerIds: string[]) {
        let itemLegendLine: d3Selection<LegendDataPoint> = item.select('.legend-item-line');
        itemLegendLine.style('fill', fill);
        itemLegendLine.style('stroke', fill);
        let itemLegendMarker: d3Selection<LegendDataPoint> = item.select('.legend-item-marker');
        let markerId: string = itemLegendMarker && itemLegendMarker.size() > 0 && itemLegendMarker.nodes()[0] ? itemLegendMarker.style('marker-start') : null;
        if (markerId) {
            let labelText: string = MarkersUtility.retrieveMarkerName(label + LegendBehavior.legendMarkerSuffix, "");
            for (let i = 0; i < markerIds.length; i++) {
                let item: string = markerIds[i];
                if (item.indexOf(labelText) != -1) {
                    let markerNotSelected: boolean = item.indexOf(LegendBehavior.dimmedLegendMarkerSuffix) != -1;
                    let isNotSelected = fill == LegendBehavior.dimmedLegendColor;
                    if (markerNotSelected == isNotSelected) {
                        markerId = item;
                        break;
                    }
                }
            }
            itemLegendMarker.style('marker-start', 'url(#' + markerId + ')');
        }
    }

    public renderSelection(hasSelection: boolean): void {
        this.renderLassoSelection(this.selectedLegendNames, hasSelection, false);
    }

    private appendLegendFontFamily() {
        let fontFamily: string = this.legendSettings.fontFamily;
        this.legendItems.selectAll('.legendText').style('font-family', fontFamily);
        d3select('svg.legend .legendTitle').style('font-family', fontFamily);
    }

//         public getSelected(): string[] {
//             return this.selectedLegendNames;
//         }
//
    public renderLassoSelection(selectedLegendNames: string[], hasSelection: boolean, multiSelect: boolean) {
        if (!selectedLegendNames)
            selectedLegendNames = [];
        if (multiSelect) {
            selectedLegendNames = selectedLegendNames.concat(this.selectedLegendNames);
        }
        this.selectedLegendNames = selectedLegendNames;

        let legendItems: d3Selection<LegendDataPoint> = this.legendItems;
        let markerIds: string[] = this.markerIds;
        let setCustomLegendIcon = this.setCustomLegendIcon;
        this.legendIcons.style("fill", (d: LegendDataPoint, index: number) => {
            let fill: string = d.color;
            if (hasSelection && selectedLegendNames.length > 0) {
                let isSelected: boolean = selectedLegendNames.indexOf(d.label) != -1;
                d.selected = multiSelect
                    ? (isSelected ? true : d.selected)
                    : isSelected;
                fill = (d.selected)
                    ? d.color
                    : LegendBehavior.dimmedLegendColor;
            } else {
                d.selected = false;
            }
            let item: d3Selection<any> = d3select(legendItems.nodes()[index]);
            setCustomLegendIcon(item, fill, d.label, markerIds);
            return fill;
        });
    }
}
