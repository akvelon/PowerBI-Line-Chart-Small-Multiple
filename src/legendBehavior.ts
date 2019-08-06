module powerbi.extensibility.visual {
    import Selection = d3.Selection;

    import IInteractiveBehavior = utils.interactivity.IInteractiveBehavior;
    import ISelectionHandler = utils.interactivity.ISelectionHandler;
    import LegendDataPoint = utils.chart.legend.LegendDataPoint;

    export class LegendBehavior implements IInteractiveBehavior {
        public static dimmedLegendColor: string = "#A6A6A6";
        public static dimmedLegendMarkerSuffix: string = "grey";
        public static legendMarkerSuffix: string = "legend";

        private static clearCatcher: Selection<any>;
        private static selectionHandler: ISelectionHandler;

        private legendItems: Selection<any>;
        private legendIcons: Selection<any>;

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
            let legendItems: Selection<any> = generateLegendItemsForLeftOrRightClick(this.legendItems, this.dataPoints, this.itemWidth, isLeft);
            if (legendItems) {
                let data = legendItems.data();
                let legendGroup: Selection<any> = d3.select(legendItems.node().parentElement);
                let legendIcons: Selection<any> = legendGroup.selectAll('circle').data(data);
                let newOptions: LegendBehaviorOptions = {
                    legendItems: legendItems,
                    legendIcons: legendIcons,
                    clearCatcher: LegendBehavior.clearCatcher
                }
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

            let markers: Selection<any> = d3.selectAll('svg.legend  marker');
            let markersLen: number = markers && markers.length > 0 && markers[0] ? markers[0].length : 0;
            this.markerIds = [];
            for(let i=0;i<markersLen;i++) {
                let item: EventTarget = markers[0][i];
                let marker: Selection<any> = d3.select(item);
                let markerId: string = marker.attr('id');
                this.markerIds.push(markerId);
            }
            let markerIds: string[] = this.markerIds;

            options.clearCatcher.on("click", () => {
                selectionHandler.handleClearSelection();
                let legendItems: Selection<LegendDataPoint> = this.legendItems;
                options.legendIcons.each((d: LegendDataPoint, index: number) => {
                    let item: Selection<any> = d3.select(legendItems[0][index]);
                    setCustomLegendIcon(item, d.color, d.label, markerIds);
                });
            });
        }

        private setCustomLegendIcon(item: Selection<any>, fill: string, label: string, markerIds: string[]) {
            let itemLegendLine: Selection<LegendDataPoint> = item.select('.legend-item-line');
            itemLegendLine.style('fill', fill);
            itemLegendLine.style('stroke', fill);
            let itemLegendMarker: Selection<LegendDataPoint> = item.select('.legend-item-marker');
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

            let legendItems: Selection<LegendDataPoint> = this.legendItems;
            let markerIds: string[] = this.markerIds;
            let setCustomLegendIcon = this.setCustomLegendIcon;
            this.legendIcons.style({
                "fill": (d: LegendDataPoint, index: number) => {
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
                    let item: Selection<any> = d3.select(legendItems[0][index]);
                    setCustomLegendIcon(item, fill, d.label, markerIds);
                    return fill;
                }
            });
        }
    }
}