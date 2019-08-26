    import * as d3 from 'd3';
    import Selection = d3.Selection;

    import powerbi from 'powerbi-visuals-api';
    import PrimitiveValue = powerbi.PrimitiveValue;
    import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;

    import { interactivityBaseService } from 'powerbi-visuals-utils-interactivityutils';
    import IInteractiveBehavior = interactivityBaseService.IInteractiveBehavior;
    import ISelectionHandler = interactivityBaseService.ISelectionHandler;
    import { legendInterfaces } from 'powerbi-visuals-utils-chartutils';
    import LegendDataPoint = legendInterfaces.LegendDataPoint;
    import { legendBehavior} from 'powerbi-visuals-utils-chartutils';
    import LegendBehaviorOptions  = legendBehavior.LegendBehaviorOptions;

    import { legendSettings } from './settings';
    import { Visual } from './visual';
    import { MarkersUtility } from './utilities/markersUtility';
    import { calculateItemWidth, drawCustomLegendIcons, generateLegendItemsForLeftOrRightClick } from './utilities/legendUtility';
    import {
        VerticalLineDataItemsGlobalWithKey,
        VisualViewModel,
        VisualDomain,
        VisualDataPoint,
        LegendDataPointExtended,
        LineDataPoint,
        LineKeyIndex,
        CategoryType,
        LegendDataExtended,
        VerticalLineDataItemsGlobal
    } from './visualInterfaces';

    export class LegendBehavior implements IInteractiveBehavior {
        public static dimmedLegendColor: string = "#A6A6A6";
        public static dimmedLegendMarkerSuffix: string = "grey";
        public static legendMarkerSuffix: string = "legend";

        private static clearCatcher: Selection<any, any, any, any>;
        private static selectionHandler: ISelectionHandler;

        private legendItems: Selection<any, any, any, any>;
        private legendIcons: Selection<any, any, any, any>;

        private legendSettings: legendSettings;
        private dataPoints: LegendDataPointExtended[];
        private markerIds: string[];
        private selectedLegendNames: string[];
        private itemWidth: number;

        constructor() {
            this.selectedLegendNames = [];
        }

        public addLegendData(legendSettings: legendSettings, dataPoints: LegendDataPointExtended[]): void {
            this.legendSettings = legendSettings;
            this.dataPoints = dataPoints;
            if (dataPoints.length < 2)
                return;
            this.itemWidth = calculateItemWidth(this.legendSettings, this.dataPoints);
        }

        public leftOrRightClick(isLeft: boolean, legendBehavior: LegendBehavior) {
            let legendItems: Selection<any, any, any, any> = generateLegendItemsForLeftOrRightClick(this.legendItems, this.dataPoints, this.itemWidth, isLeft);
            if (legendItems) {
                let data = legendItems.data();
                let legendGroup: Selection<any, any, any, any> = d3.select(legendItems.node().parentElement);
                let legendIcons: Selection<any, any, any, any> = legendGroup.selectAll('circle').data(data);
                let newOptions: LegendBehaviorOptions = {
                    legendItems: legendItems,
                    legendIcons: legendIcons,
                    clearCatcher: LegendBehavior.clearCatcher
                } as LegendBehaviorOptions;
                legendBehavior.bindEvents(newOptions, LegendBehavior.selectionHandler);
            }
        }

        public bindEvents(options: LegendBehaviorOptions, selectionHandler: ISelectionHandler): void {
            this.legendItems = options.legendItems;
            this.legendIcons = options.legendIcons;
            LegendBehavior.clearCatcher = options.clearCatcher;
            LegendBehavior.selectionHandler = selectionHandler;

            //interactivityUtils.registerStandardSelectionHandler(options.legendItems, selectionHandler);

            this.appendLegendFontFamily();
            if (this.legendSettings && this.dataPoints) {
                drawCustomLegendIcons(this.legendItems, this.legendSettings, this.dataPoints);
            }

            let setCustomLegendIcon = this.setCustomLegendIcon;

            options.legendItems.on("click", (d: LegendDataPoint) => {
                let mouseEvent: MouseEvent = d3.event as MouseEvent;
                let multiSelect: boolean = mouseEvent.ctrlKey;
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

            let markers/*: Selection<any, any, any, any>*/ = d3.selectAll('svg.legend  marker');
            //let markersLen: number = markers && markers.length > 0 && markers[0] ? markers[0].length : 0;
            let markersLen = markers && markers[0] ? [...markers[0].children].length : 0;
            this.markerIds = [];
            for(let i=0;i<markersLen;i++) {
                let item/*: EventTarget*/ = markers[0][i];
                let marker: Selection<any, any, any, any> = d3.select(item);
                let markerId: string = marker.attr('id');
                this.markerIds.push(markerId);
            }
            let markerIds: string[] = this.markerIds;

            options.clearCatcher.on("click", () => {
                selectionHandler.handleClearSelection();
                let legendItems: Selection<any, any, any, any> = this.legendItems;
                options.legendIcons.each((d: LegendDataPoint, index: number) => {
                    let item: Selection<any, any, any, any> = d3.select(legendItems[0][index]);
                    setCustomLegendIcon(item, d.color, d.label, markerIds);
                });
            });
        }

        private setCustomLegendIcon(item: Selection<any, any, any, any>, fill: string, label: string, markerIds: string[]) {
            let itemLegendLine: Selection<any, any, any, any> = item.select('.legend-item-line');
            itemLegendLine.style('fill', fill);
            itemLegendLine.style('stroke', fill);
            let itemLegendMarker: Selection<any, any, any, any> = item.select('.legend-item-marker');
            let markerId: string = itemLegendMarker && itemLegendMarker[0] && itemLegendMarker[0][0] ? itemLegendMarker.style('marker-start') : null;
            if (markerId) {
                let labelText: string = MarkersUtility.retrieveMarkerName(label + LegendBehavior.legendMarkerSuffix, "");
                for(let i=0;i<markerIds.length;i++) {
                    let item: string = markerIds[i];
                    if (item.indexOf(labelText) != -1) {
                        let markerNotSelected: boolean = item.indexOf(LegendBehavior.dimmedLegendMarkerSuffix)!=-1;
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
            d3.select('svg.legend .legendTitle').style('font-family', fontFamily);
        }

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

            let legendItems: Selection<any, any, any, any> = this.legendItems;
            let markerIds: string[] = this.markerIds;
            let setCustomLegendIcon = this.setCustomLegendIcon;
            this.legendIcons.style(
                "fill", (d: LegendDataPoint, index: number) => {
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
                    let item: Selection<any, any, any, any> = d3.select(legendItems[0] && legendItems[0][index] || (<any>legendItems)._groups[0][index]);
                    setCustomLegendIcon(item, fill, d.label, markerIds);
                    return fill;
                }
            );
        }
    }
