'use strict';

import {
    IInteractiveBehavior,
    ISelectionHandler,
} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {d3Selection} from './visualInterfaces';
import {LegendSettings} from './settings';
import {calculateItemWidth} from './utilities/legendUtility';
import {BaseType, Selection} from 'd3-selection';
import {
    ScrollableLegendBehaviorOptions,
    ScrollableLegendDataPoint,
} from './utilities/scrollableLegend';

export class LegendBehavior implements IInteractiveBehavior {
    public static readonly dimmedLegendColor: string = '#A6A6A6';

    private clearCatcher: d3Selection<any>;
    private selectionHandler: ISelectionHandler;

    private legendItems: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    private legendIcons: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    private legendItemLines: Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;

    private legendSettings: LegendSettings;
    private dataPoints: ScrollableLegendDataPoint[];
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

    public bindEvents(options: ScrollableLegendBehaviorOptions, selectionHandler: ISelectionHandler): void {
        this.legendItems = options.legendItems;
        this.legendIcons = options.legendIcons;
        this.legendItemLines = options.legendItemLines;
        this.clearCatcher = options.clearCatcher;
        this.selectionHandler = selectionHandler;

        options.legendItems.on('click', (e: MouseEvent, d: ScrollableLegendDataPoint) => {
            const multiSelect: boolean = e.ctrlKey;
            const label = d.tooltip ?? d.label;
            const index: number = this.selectedLegendNames.indexOf(label);
            if (index == -1) {
                if (multiSelect)
                    this.selectedLegendNames.push(label);
                else
                    this.selectedLegendNames = [label];
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

        options.clearCatcher.on('click', () => {
            this.selectedLegendNames = [];
            selectionHandler.handleClearSelection();
        });
    }

    public renderSelection(hasSelection: boolean): void {
        this.renderLassoSelection(this.selectedLegendNames, hasSelection, false);
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

        const isSelected = (d: ScrollableLegendDataPoint) => {
            const isSelectedPreviously: boolean = selectedLegendNames.indexOf(d.tooltip ?? d.label) != -1;
            return multiSelect
                ? isSelectedPreviously || d.selected
                : isSelectedPreviously;
        };

        const getLegendSelectionColor = (d: ScrollableLegendDataPoint): string | null =>
            selectedLegendNames.length == 0 || isSelected(d) ? d.color ?? null : LegendBehavior.dimmedLegendColor;

        this.legendIcons
            .style('fill', getLegendSelectionColor);
        this.legendItemLines
            .style('fill', getLegendSelectionColor)
            .style('stroke', getLegendSelectionColor);
    }
}
