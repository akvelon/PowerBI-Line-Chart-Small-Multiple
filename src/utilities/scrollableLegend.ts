/*
*  Power BI Visualizations
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/

/*
 * This is a modified version of SVGLegend from PowerBI legend utils.
 * Added more supported icons and scroll arrows for horizontal layout.
 */

import {
    LegendPosition,
    LegendPosition2D,
    LineStyle,
} from 'powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces';
import powerbi from 'powerbi-visuals-api';
import {
    appendClearCatcher,
    dataHasSelection,
    IBehaviorOptions,
    IInteractiveBehavior,
    IInteractivityService,
} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {BaseType, select as d3select, Selection as d3Selection} from 'd3-selection';
import {LegendBehavior} from 'powerbi-visuals-utils-chartutils/lib/legend/behavior/legendBehavior';
import {SelectableDataPoint} from 'powerbi-visuals-utils-interactivityutils/lib/interactivitySelectionService';
import {SeriesMarkerShape} from '../seriesMarkerShape';
import {isLongLegendIconType, LegendIconType} from '../legendIconType';
import {pixelConverter as PixelConverter, prototype as Prototype} from 'powerbi-visuals-utils-typeutils';
import {
    LegendLayout,
    NavigationArrow,
    SVGLegend,
    TitleLayout,
} from 'powerbi-visuals-utils-chartutils/lib/legend/svgLegend';
import {manipulation as svgManipulation} from 'powerbi-visuals-utils-svgutils';
import {createClassAndSelector} from 'powerbi-visuals-utils-svgutils/lib/cssConstants';
import {textMeasurementService} from 'powerbi-visuals-utils-formattingutils';
import {TextProperties} from './textUtility';
import {MarkersUtility} from './markersUtility';
import DataViewObjects = powerbi.DataViewObjects;
import ISelectionId = powerbi.visuals.ISelectionId;

export interface IScrollableLegend {
    drawLegend(data: ScrollableLegendData, viewport: powerbi.IViewport): void;

    changeOrientation(orientation: LegendPosition): void;

    getMargins(): powerbi.IViewport;

    getOrientation(): LegendPosition;

    isVisible(): boolean;
}

export interface ScrollableLegendDataPoint extends SelectableDataPoint, LegendPosition2D {
    label: string;
    color: string;
    category?: string;
    measure?: any;
    iconOnlyOnLabel?: boolean;
    tooltip?: string;
    layerNumber?: number;
    lineStyle?: LineStyle;
    legendIconType: LegendIconType;
    seriesMarkerShape: SeriesMarkerShape;
    object: DataViewObjects;
    showMarkers?: boolean;
}

export interface ScrollableLegendData {
    title?: string;
    dataPoints: ScrollableLegendDataPoint[];
    grouped?: boolean;
    labelColor?: string;
    fontSize?: number;
    fontFamily?: string;
}

export interface ScrollableLegendItem {
    dataPoint: ScrollableLegendDataPoint;
    textProperties: TextProperties;
    width: number;
    desiredWidth: number;
    desiredOverMaxWidth: boolean;
}

export interface ScrollableLegendBehaviorOptions extends IBehaviorOptions<ScrollableLegendDataPoint> {
    legendItems: d3Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    legendItemLines: d3Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    legendIcons: d3Selection<BaseType, ScrollableLegendDataPoint, SVGGElement, unknown>;
    clearCatcher: d3Selection<any, any, any, any>;
}


export const createLegend = (
    legendParentElement: HTMLElement,
    interactivityService: IInteractivityService<ScrollableLegendDataPoint>,
    isScrollable: boolean,
    legendPosition: LegendPosition,
    interactiveBehavior: IInteractiveBehavior,
): IScrollableLegend =>
    new ScrollableLegend(
        legendParentElement,
        legendPosition,
        interactivityService,
        isScrollable,
        interactiveBehavior);

export class ScrollableLegend implements IScrollableLegend {
    private static readonly TopLegendHeight = 24;
    private static readonly LegendMaxWidthFactor = 0.3;
    private static readonly TitlePadding = 15;
    private static readonly LegendArrowHeight = 15;
    private static readonly LegendArrowWidth = 7.5;
    private static readonly TextAndIconPadding = 5;
    private static readonly LegendIconRadius = 5;
    private static readonly LegendArrowOffset = 10;
    private static readonly MaxTextLength = 60;
    private static readonly LegendEdgeMariginWidth = 10;
    private static readonly LegendIconYRatio = 0.52;
    private static readonly MarkerLineLength = 30;
    private static readonly LegendTitle = createClassAndSelector('legendTitle');
    private static readonly LegendItem = createClassAndSelector('legendItem');
    private static readonly LegendIcon = createClassAndSelector('legendIcon');
    private static readonly LegendText = createClassAndSelector('legendText');
    private static readonly LegendItemLine = createClassAndSelector('legendItemLine');
    private static readonly NavigationArrow = createClassAndSelector('navArrow');
    private static readonly DefaultTextMargin = PixelConverter.fromPointToPixel(SVGLegend.DefaultFontSizeInPt);

    private readonly element: HTMLElement;
    private readonly svg: d3Selection<BaseType, unknown, HTMLElement, any>;
    private readonly clearCatcher: d3Selection<any, any, any, any>;
    private readonly group: d3Selection<SVGGElement, unknown, HTMLElement, any>;
    private readonly interactiveBehavior: IInteractiveBehavior;
    private readonly interactivityService: IInteractivityService<ScrollableLegendDataPoint>;
    private readonly isScrollable: boolean;

    private viewport: powerbi.IViewport;
    private parentViewport: powerbi.IViewport;
    private orientation: LegendPosition;
    private data: ScrollableLegendData;
    private lastCalculatedWidth = 0;
    private visibleLegendWidth = 0;
    private visibleLegendHeight = 0;
    private legendDataStartIndex = 0;
    private legendFontSizeMarginValue = 0;
    private legendFontSizeMarginDifference = 0;
    private arrowPosWindow = 1;

    constructor(
        element: HTMLElement,
        legendPosition: LegendPosition,
        interactivityService: IInteractivityService<ScrollableLegendDataPoint>,
        isScrollable: boolean,
        interactiveBehavior?: IInteractiveBehavior) {
        this.svg = d3select(element)
            .append('svg')
            .style('position', 'absolute');
        this.svg.style('display', 'inherit');
        this.svg.classed('legend', true);

        if (interactivityService) {
            this.clearCatcher = appendClearCatcher(this.svg);
        }

        this.group = this.svg
            .append('g')
            .attr('id', 'legendGroup');

        this.interactiveBehavior = interactiveBehavior ? interactiveBehavior : new LegendBehavior();
        this.interactivityService = interactivityService;
        this.isScrollable = isScrollable;
        this.element = element;
        this.changeOrientation(legendPosition);
        this.parentViewport = {height: 0, width: 0};
        this.calculateViewport();
        this.updateLayout();
    }

    public static getStrokeDashArrayForLegend(style: LineStyle): string {
        switch (style) {
            case LineStyle.dashed: {
                return '7,5';
            }
            case LineStyle.dotted: {
                return '2.5,3.1';
            }
            case LineStyle.dotdash: {
                return '2.5,3.1,7,3.1';
            }
            case LineStyle.dashdot: {
                return '7,3.1,2.5,3.1';
            }
            case LineStyle.solid: {
                return null;
            }
        }
    }

    private static getTextProperties(text: string, fontSize: number, fontFamily: string): TextProperties {
        return {
            fontFamily,
            fontSize: PixelConverter.fromPoint(fontSize || SVGLegend.DefaultFontSizeInPt),
            text,
        };
    }

    /**
     * Calculates the widths for each horizontal legend item.
     */
    private static calculateHorizontalLegendItemsWidths(dataPoints: ScrollableLegendDataPoint[], availableWidth: number, iconPadding: number, fontSize: number, fontFamily: string): ScrollableLegendItem[] {
        const dataPointsLength = dataPoints.length;
        // Set the maximum amount of space available to each item. They can use less, but can"t go over this number.
        let maxItemWidth = dataPointsLength > 0 ? availableWidth / dataPointsLength | 0 : 0;
        let maxItemTextWidth = maxItemWidth - iconPadding;
        // Makes sure the amount of space available to each item is at least SVGLegend.MaxTextLength wide.
        // If you had many items and/or a narrow amount of available width, the availableTextWidthPerItem would be small, essentially making everything ellipsis.
        // This prevents that from happening by giving each item at least SVGLegend.MaxTextLength of space.
        if (maxItemTextWidth < ScrollableLegend.MaxTextLength) {
            maxItemTextWidth = ScrollableLegend.MaxTextLength;
            maxItemWidth = maxItemTextWidth + iconPadding;
        }
        // Make sure the availableWidthPerItem is less than the availableWidth. This lets the long text properly add ellipsis when we"re displaying one item at a time.
        if (maxItemWidth > availableWidth) {
            maxItemWidth = availableWidth;
            maxItemTextWidth = maxItemWidth - iconPadding;
        }
        let occupiedWidth = 0;
        const legendItems: ScrollableLegendItem[] = [];
        // Add legend items until we can"t fit any more (the last one doesn"t fit) or we"ve added all of them
        for (const dataPoint of dataPoints) {
            const textProperties = ScrollableLegend.getTextProperties(dataPoint.label, fontSize, fontFamily);
            const itemTextWidth = textMeasurementService.measureSvgTextWidth(textProperties);
            const desiredWidth = itemTextWidth + iconPadding;
            const overMaxWidth = desiredWidth > maxItemWidth;
            const actualWidth = overMaxWidth ? maxItemWidth : desiredWidth;
            occupiedWidth += actualWidth;
            if (occupiedWidth >= availableWidth) {
                // Always add at least 1 element
                if (legendItems.length === 0) {
                    legendItems.push({
                        dataPoint: dataPoint,
                        textProperties: textProperties,
                        desiredWidth: desiredWidth,
                        desiredOverMaxWidth: true,
                        width: desiredWidth,
                    });
                    // Set the width to the amount of space we actually have
                    occupiedWidth = availableWidth;
                } else {
                    // Subtract the width from what was just added since it won"t fit
                    occupiedWidth -= actualWidth;
                }
                break;
            }
            legendItems.push({
                dataPoint: dataPoint,
                textProperties: textProperties,
                desiredWidth: desiredWidth,
                desiredOverMaxWidth: overMaxWidth,
                width: desiredWidth,
            });
        }
        // If there are items at max width, evenly redistribute the extra space to them
        const itemsOverMax = legendItems.filter((li) => li.desiredOverMaxWidth);
        let numItemsOverMax = itemsOverMax.length;
        if (numItemsOverMax > 0) {
            let extraWidth = availableWidth - occupiedWidth;
            for (const item of itemsOverMax) {
                // Divvy up the extra space and add it to the max
                // We need to do this calculation in every loop since the remainingWidth may not be changed by the same amount every time
                const extraWidthPerItem = extraWidth / numItemsOverMax;
                const newMaxItemWidth = maxItemWidth + extraWidthPerItem;
                let usedExtraWidth;
                if (item.desiredWidth <= newMaxItemWidth) {
                    // If the item doesn"t need all the extra space, it"s not at max anymore
                    item.desiredOverMaxWidth = false;
                    usedExtraWidth = item.desiredWidth - maxItemWidth;
                } else {
                    // Otherwise the item is taking up all the extra space so update the actual width to indicate that
                    item.width = newMaxItemWidth;
                    usedExtraWidth = newMaxItemWidth - maxItemWidth;
                }
                extraWidth -= usedExtraWidth;
                numItemsOverMax--;
            }
        }
        return legendItems;
    }

    drawLegend(data: ScrollableLegendData, viewport: powerbi.IViewport): void {
        // clone because we modify legend item label with ellipsis if it is truncated
        const clonedData = Prototype.inherit(data), newDataPoints = [];
        for (const dp of data.dataPoints) {
            newDataPoints.push(Prototype.inherit(dp));
        }
        clonedData.dataPoints = newDataPoints;
        this.setTooltipToLegendItems(clonedData);
        this.drawLegendInternal(clonedData, viewport, true /* perform auto width */);
    }

    changeOrientation(orientation: LegendPosition): void {
        if (orientation) {
            this.orientation = orientation;
        } else {
            this.orientation = LegendPosition.Top;
        }

        this.svg.attr('orientation', orientation);
    }

    getMargins(): powerbi.IViewport {
        return this.viewport;
    }

    getOrientation(): LegendPosition {
        return this.orientation;
    }

    isVisible(): boolean {
        return this.orientation !== LegendPosition.None;
    }

    private calculateViewport(): void {
        switch (this.orientation) {
            case LegendPosition.Top:
            case LegendPosition.Bottom:
            case LegendPosition.TopCenter:
            case LegendPosition.BottomCenter: {
                const pixelHeight = PixelConverter.fromPointToPixel(this.data && this.data.fontSize
                    ? this.data.fontSize
                    : SVGLegend.DefaultFontSizeInPt);
                const fontHeightSize = ScrollableLegend.TopLegendHeight + (pixelHeight - SVGLegend.DefaultFontSizeInPt);
                this.viewport = {height: fontHeightSize, width: 0};
                return;
            }
            case LegendPosition.Right:
            case LegendPosition.Left:
            case LegendPosition.RightCenter:
            case LegendPosition.LeftCenter: {
                const width = this.lastCalculatedWidth
                    ? this.lastCalculatedWidth
                    : this.parentViewport.width * ScrollableLegend.LegendMaxWidthFactor;
                this.viewport = {height: 0, width: width};
                return;
            }
            case LegendPosition.None:
                this.viewport = {height: 0, width: 0};
        }
    }

    private updateLayout(): void {
        const legendViewport = this.viewport;
        const orientation = this.orientation;
        this.svg.attr('height', legendViewport.height || (orientation === LegendPosition.None ? 0 : this.parentViewport.height));
        this.svg.attr('width', legendViewport.width || (orientation === LegendPosition.None ? 0 : this.parentViewport.width));
        const isRight = orientation === LegendPosition.Right || orientation === LegendPosition.RightCenter,
            isBottom = orientation === LegendPosition.Bottom || orientation === LegendPosition.BottomCenter;
        this.svg.style('margin-left', isRight ? (this.parentViewport.width - legendViewport.width) + 'px' : null);
        this.svg.style('margin-top', isBottom ? (this.parentViewport.height - legendViewport.height) + 'px' : null);
    }

    private setTooltipToLegendItems(data: ScrollableLegendData): void {
        // we save the values to tooltip before cut
        for (const dataPoint of data.dataPoints) {
            dataPoint.tooltip = dataPoint.label;
        }
    }

    /* eslint-disable-next-line max-lines-per-function */
    private drawLegendInternal(data: ScrollableLegendData, viewport: powerbi.IViewport, autoWidth: boolean): void {
        this.parentViewport = viewport;
        this.data = data;
        if (this.interactivityService)
            this.interactivityService.applySelectionStateToData(data.dataPoints);
        if (data.dataPoints.length === 0) {
            this.changeOrientation(LegendPosition.None);
        }
        if (this.getOrientation() === LegendPosition.None) {
            data.dataPoints = [];
        }
        // Adding back the workaround for Legend Left/Right position for Map
        const mapControls = this.element.getElementsByClassName('mapControl');
        if (mapControls.length > 0 && !this.isTopOrBottom(this.orientation)) {
            for (let i = 0; i < mapControls.length; ++i) {
                const element = mapControls[i] as HTMLElement;
                element.style.display = 'inline-block';
            }
        }
        this.calculateViewport();
        const layout = this.calculateLayout(data, autoWidth);
        const titleLayout = layout.title;
        const titleData = titleLayout ? [titleLayout] : [];
        const hasSelection = this.interactivityService && dataHasSelection(data.dataPoints);
        const group = this.group;
        // transform the wrapping group if position is centered
        if (this.isCentered(this.orientation)) {
            let centerOffset = 0;
            if (this.isTopOrBottom(this.orientation)) {
                centerOffset = Math.max(0, (this.parentViewport.width - this.visibleLegendWidth) / 2);
                group.attr('transform', svgManipulation.translate(centerOffset, 0));
            } else {
                centerOffset = Math.max((this.parentViewport.height - this.visibleLegendHeight) / 2);
                group.attr('transform', svgManipulation.translate(0, centerOffset));
            }
        } else {
            group.attr('transform', null);
        }
        const legendTitle = group
            .selectAll(ScrollableLegend.LegendTitle.selectorName);
        const legendTitleData = legendTitle.data(titleData);
        const enteredLegendTitle = legendTitleData
            .enter()
            .append('text')
            .classed(ScrollableLegend.LegendTitle.className, true);
        legendTitleData
            .merge(enteredLegendTitle)
            .style('fill', data.labelColor)
            .style('font-size', PixelConverter.fromPoint(data.fontSize))
            .style('font-family', data.fontFamily)
            .text((d) => d.text)
            .attr('x', (d) => d.x)
            .attr('y', (d) => d.y)
            .append('title')
            .text(data.title);
        legendTitleData
            .exit()
            .remove();


        const virtualizedDataPoints = data.dataPoints.slice(this.legendDataStartIndex, this.legendDataStartIndex + layout.numberOfItems);
        const legendItems = group
            .selectAll(ScrollableLegend.LegendItem.selectorName)
            .data(virtualizedDataPoints, (d: ScrollableLegendDataPoint) => {
                return (d.identity as ISelectionId).getKey() + (d.layerNumber != null ? d.layerNumber : '');
            });

        const itemsEnter = legendItems.enter()
            .append('g')
            .classed(ScrollableLegend.LegendItem.className, true);

        itemsEnter
            .append('path')
            .classed(ScrollableLegend.LegendItemLine.className, true);
        itemsEnter
            .append('path')
            .classed(ScrollableLegend.LegendIcon.className, true);
        itemsEnter
            .append('text')
            .classed(ScrollableLegend.LegendText.className, true);
        itemsEnter
            .append('title')
            .text((d) => d.tooltip);

        const mergedLegendIcons = legendItems
            .merge(itemsEnter)
            .select(ScrollableLegend.LegendIcon.selectorName)
            .attr('transform', (dataPoint) => {
                return svgManipulation.translateAndScale(dataPoint.glyphPosition.x, dataPoint.glyphPosition.y, 1);
            })
            .attr('d', (dataPoint) => {
                return MarkersUtility.getPath(dataPoint.seriesMarkerShape || SeriesMarkerShape.circle);
            })
            .attr('stroke-width', (dataPoint) => {
                if (dataPoint.lineStyle) {
                    return 2;
                }
                return MarkersUtility.getStrokeWidth(dataPoint.seriesMarkerShape || SeriesMarkerShape.circle);
            })
            .attr('opacity', (d) =>
                d.legendIconType == LegendIconType.markers || d.legendIconType == LegendIconType.lineMarkers
                    ? 1
                    : 0)
            .style('fill', (dataPoint) => {
                if (dataPoint.lineStyle) {
                    return null;
                }
                return dataPoint.color;
            })
            .style('stroke', (dataPoint) => dataPoint.color)
            .style('stroke-dasharray', (dataPoint) => {
                if (dataPoint.lineStyle) {
                    return ScrollableLegend.getStrokeDashArrayForLegend(dataPoint.lineStyle);
                }
                return null;
            })
            .style('stroke-linejoin', 'round');

        const mergedLegendItemLines = legendItems
            .merge(itemsEnter)
            .select(ScrollableLegend.LegendItemLine.selectorName)
            .attr('transform', (dataPoint) => {
                return svgManipulation.translateAndScale(dataPoint.glyphPosition.x, dataPoint.glyphPosition.y, 1);
            })
            .attr('d', (d) => {
                const padding: number = data.fontSize / 4;
                // const lineStart: number = -ScrollableLegend.MarkerLineLength - padding;
                // const lineEnd: number = -padding;
                const lineStart = -ScrollableLegend.MarkerLineLength / 2;
                const lineEnd = ScrollableLegend.MarkerLineLength / 2;
                return 'M' + lineStart + ',0L' + lineEnd + ',0';
            })
            .attr('stroke-width', '2')
            .style('fill', (d) => d.color)
            .style('stroke', (d) => d.color)
            .style('opacity', (d) => d.legendIconType == LegendIconType.lineMarkers || d.legendIconType == LegendIconType.line ? 1.0 : 0.0);

        //     const padding: number = legendSettings.fontSize / 4;
        //     const lineStart: number = -lineLen - padding;
        //     const lineEnd: number = -padding;
        // .
        //     attr('d', 'M' + lineStart + ',0L' + lineEnd + ',0');

        legendItems
            .merge(itemsEnter)
            .select('title')
            .text((dataPoint) => dataPoint.tooltip);
        const mergedLegendItems = legendItems.merge(itemsEnter);
        const mergedLegendText = mergedLegendItems
            .select(ScrollableLegend.LegendText.selectorName)
            .attr('x', (dataPoint) => dataPoint.textPosition.x)
            .attr('y', (dataPoint) => dataPoint.textPosition.y)
            .text((d) => d.label)
            .style('fill', data.labelColor)
            .style('font-size', PixelConverter.fromPoint(data.fontSize))
            .style('font-family', data.fontFamily);

        if (this.interactivityService) {
            const behaviorOptions: ScrollableLegendBehaviorOptions = {
                legendItems: mergedLegendItems,
                legendIcons: mergedLegendIcons,
                legendItemLines: mergedLegendItemLines,
                clearCatcher: this.clearCatcher,
                dataPoints: data.dataPoints,
                behavior: this.interactiveBehavior,
                interactivityServiceOptions: {
                    isLegend: true,
                },
            };
            this.interactivityService.bind(behaviorOptions);
            this.interactiveBehavior.renderSelection(hasSelection);
        }
        legendItems
            .exit()
            .remove();
        this.drawNavigationArrows(layout.navigationArrows);
        this.updateLayout();
    }

    private isTopOrBottom(orientation: LegendPosition) {
        switch (orientation) {
            case LegendPosition.Top:
            case LegendPosition.Bottom:
            case LegendPosition.BottomCenter:
            case LegendPosition.TopCenter:
                return true;
            default:
                return false;
        }
    }

    /** Performs layout offline for optimal perfomance */
    private calculateLayout(data: ScrollableLegendData, autoWidth: boolean): LegendLayout {
        let dataPoints = data.dataPoints;
        if (data.dataPoints.length === 0) {
            return {
                numberOfItems: 0,
                title: null,
                navigationArrows: [],
            };
        }
        this.legendFontSizeMarginValue = PixelConverter.fromPointToPixel(this.data && this.data.fontSize !== undefined ? this.data.fontSize : SVGLegend.DefaultFontSizeInPt);
        this.legendFontSizeMarginDifference = (this.legendFontSizeMarginValue - ScrollableLegend.DefaultTextMargin);
        this.normalizePosition(dataPoints);
        if (this.legendDataStartIndex < dataPoints.length) {
            dataPoints = dataPoints.slice(this.legendDataStartIndex);
        }
        const title = this.calculateTitleLayout(data.title);
        let navArrows: NavigationArrow[];
        let numberOfItems: number;
        if (this.isTopOrBottom(this.orientation)) {
            navArrows = this.isScrollable ? this.calculateHorizontalNavigationArrowsLayout(title) : [];
            numberOfItems = this.calculateHorizontalLayout(dataPoints, title, navArrows);
        } else {
            navArrows = this.isScrollable ? this.calculateVerticalNavigationArrowsLayout(title) : [];
            numberOfItems = this.calculateVerticalLayout(dataPoints, title, navArrows, autoWidth);
        }
        return {
            numberOfItems,
            title,
            navigationArrows: navArrows,
        };
    }

    private isCentered(orientation: LegendPosition): boolean {
        switch (orientation) {
            case LegendPosition.BottomCenter:
            case LegendPosition.LeftCenter:
            case LegendPosition.RightCenter:
            case LegendPosition.TopCenter:
                return true;
            default:
                return false;
        }
    }

    normalizePosition(points: ScrollableLegendDataPoint[]): void {
        if (this.legendDataStartIndex >= points.length) {
            this.legendDataStartIndex = points.length - 1;
        }
        if (this.legendDataStartIndex < 0) {
            this.legendDataStartIndex = 0;
        }
    }

    calculateTitleLayout(title: string): TitleLayout {
        let width = 0;
        const hasTitle = !!title;
        if (hasTitle) {
            const isHorizontal = this.isTopOrBottom(this.orientation);
            const textProperties = ScrollableLegend.getTextProperties(title, this.data.fontSize, this.data.fontFamily);
            let text = title;
            width = textMeasurementService.measureSvgTextWidth(textProperties);
            if (isHorizontal) {
                width += ScrollableLegend.TitlePadding;
            } else {
                text = textMeasurementService.getTailoredTextOrDefault(textProperties, this.viewport.width);
            }
            return {
                text,
                width,
                x: 0,
                y: 0,
                height: textMeasurementService.estimateSvgTextHeight(textProperties),
            };
        }

        return null;
    }

    calculateHorizontalNavigationArrowsLayout(title: TitleLayout): NavigationArrow[] {
        const height = ScrollableLegend.LegendArrowHeight;
        const width = ScrollableLegend.LegendArrowWidth;
        const translateY = (this.viewport.height / 2) - (height / 2);
        const data = [];
        const rightShift = title ? title.x + title.width : 0;
        const arrowLeft = svgManipulation.createArrow(width, height, 180 /*angle*/);
        const arrowRight = svgManipulation.createArrow(width, height, 0 /*angle*/);
        data.push({
            x: rightShift,
            y: translateY,
            path: arrowLeft.path,
            rotateTransform: arrowLeft.transform,
            dataType: 1, /* NavigationArrowType.Decrease */
        });
        data.push({
            x: this.parentViewport.width - width,
            y: translateY,
            path: arrowRight.path,
            rotateTransform: arrowRight.transform,
            dataType: 0, /* NavigationArrowType.Increase */
        });
        return data;
    }

    calculateHorizontalLayout(dataPoints: ScrollableLegendDataPoint[], title: TitleLayout, navigationArrows: NavigationArrow[]): number {
        const fontSizeBiggerThanDefault = this.legendFontSizeMarginDifference > 0;
        const fontSizeMargin = fontSizeBiggerThanDefault
            ? ScrollableLegend.TextAndIconPadding + this.legendFontSizeMarginDifference
            : ScrollableLegend.TextAndIconPadding;
        let occupiedWidth = 0;

        const firstDataPoint = dataPoints && dataPoints[0];
        const firstDataPointMarkerShape = firstDataPoint && firstDataPoint.seriesMarkerShape;
        const firstDataPointIsLongIcon = firstDataPoint && isLongLegendIconType(firstDataPoint.legendIconType);
        const iconTotalItemPadding = firstDataPointIsLongIcon
            ? ScrollableLegend.MarkerLineLength + fontSizeMargin * 1.5
            : this.getMarkerShapeWidth(firstDataPointMarkerShape) + fontSizeMargin * 1.5;

        let numberOfItems = dataPoints.length;
        // get the Y coordinate which is the middle of the container + the middle of the text height - the delta of the text
        const defaultTextProperties = ScrollableLegend.getTextProperties('', this.data.fontSize, this.data.fontFamily);
        const verticalCenter = this.viewport.height / 2;
        const textYCoordinate = verticalCenter + textMeasurementService.estimateSvgTextHeight(defaultTextProperties) / 2
            - textMeasurementService.estimateSvgTextBaselineDelta(defaultTextProperties);
        if (title) {
            occupiedWidth += title.width;
            // get the Y coordinate which is the middle of the container + the middle of the text height - the delta of the text
            title.y = verticalCenter
                + title.height / 2
                - textMeasurementService.estimateSvgTextBaselineDelta(ScrollableLegend.getTextProperties(title.text, this.data.fontSize, this.data.fontFamily));
        }
        // if an arrow should be added, we add space for it
        if (this.legendDataStartIndex > 0) {
            occupiedWidth += ScrollableLegend.LegendArrowOffset;
        }
        // Calculate the width for each of the legend items
        const dataPointsLength = dataPoints.length;
        let availableWidth = this.parentViewport.width - occupiedWidth;
        let legendItems = ScrollableLegend.calculateHorizontalLegendItemsWidths(dataPoints, availableWidth, iconTotalItemPadding, this.data.fontSize, this.data.fontFamily);
        numberOfItems = legendItems.length;
        // If we can"t show all the legend items, subtract the "next" arrow space from the available space and re-run the width calculations
        if (numberOfItems !== dataPointsLength) {
            availableWidth -= ScrollableLegend.LegendArrowOffset;
            legendItems = ScrollableLegend.calculateHorizontalLegendItemsWidths(dataPoints, availableWidth, iconTotalItemPadding, this.data.fontSize, this.data.fontFamily);
            numberOfItems = legendItems.length;
        }
        for (const legendItem of legendItems) {
            const {dataPoint} = legendItem;
            const markerShapeWidth = isLongLegendIconType(dataPoint.legendIconType)
                ? ScrollableLegend.MarkerLineLength
                : this.getMarkerShapeWidth(dataPoint.seriesMarkerShape);
            dataPoint.glyphPosition = {
                // the space taken so far + the radius + the margin / radiusFactor to prevent huge spaces
                x: occupiedWidth + markerShapeWidth / 2 + (this.legendFontSizeMarginDifference / this.getLegendIconFactor(dataPoint.seriesMarkerShape)),
                // The middle of the container but a bit lower due to text not being in the middle (qP for example making middle between q and P)
                y: this.viewport.height * ScrollableLegend.LegendIconYRatio,
            };
            const fixedTextShift = (fontSizeMargin / (this.getLegendIconFactor(dataPoint.seriesMarkerShape) / 2)) + markerShapeWidth;
            dataPoint.textPosition = {
                x: occupiedWidth + fixedTextShift,
                y: textYCoordinate,
            };
            // If we're over the max width, process it so it fits
            if (legendItem.desiredOverMaxWidth) {
                const textWidth = legendItem.width - iconTotalItemPadding;
                dataPoint.label = textMeasurementService.getTailoredTextOrDefault(legendItem.textProperties, textWidth);
            }
            occupiedWidth += legendItem.width;
        }
        this.visibleLegendWidth = occupiedWidth;
        this.updateNavigationArrowLayout(navigationArrows, dataPointsLength, numberOfItems);
        return numberOfItems;
    }

    getMarkerShapeWidth(markerShape: SeriesMarkerShape): number {
        switch (markerShape) {
            default: {
                return ScrollableLegend.LegendIconRadius * 2;
            }
        }
    }

    updateNavigationArrowLayout(navigationArrows: NavigationArrow[], remainingDataLength: number, visibleDataLength: number): void {
        if (this.legendDataStartIndex === 0) {
            navigationArrows.shift();
        }
        const lastWindow = this.arrowPosWindow;
        this.arrowPosWindow = visibleDataLength;
        if (navigationArrows && navigationArrows.length > 0 && this.arrowPosWindow === remainingDataLength) {
            this.arrowPosWindow = lastWindow;
            navigationArrows.length = navigationArrows.length - 1;
        }
    }

    calculateVerticalNavigationArrowsLayout(title: TitleLayout): NavigationArrow[] {
        const height = ScrollableLegend.LegendArrowHeight;
        const width = ScrollableLegend.LegendArrowWidth;
        const verticalCenter = this.viewport.height / 2;
        const data: NavigationArrow[] = [];
        const rightShift = verticalCenter + height / 2;
        const arrowTop = svgManipulation.createArrow(width, height, 270 /*angle*/);
        const arrowBottom = svgManipulation.createArrow(width, height, 90 /*angle*/);
        const titleHeight = title ? title.height : 0;
        data.push({
            x: rightShift,
            y: width + titleHeight,
            path: arrowTop.path,
            rotateTransform: arrowTop.transform,
            dataType: 1, /* NavigationArrowType.Decrease */
        });
        data.push({
            x: rightShift,
            y: this.parentViewport.height - height,
            path: arrowBottom.path,
            rotateTransform: arrowBottom.transform,
            dataType: 0, /* NavigationArrowType.Increase */
        });
        return data;
    }

    drawNavigationArrows(layout: NavigationArrow[]): void {
        let arrows: d3Selection<any, NavigationArrow, any, any> = this.group.selectAll(ScrollableLegend.NavigationArrow.selectorName)
            .data(layout);
        arrows.exit().remove();
        arrows = arrows.merge(arrows
            .enter()
            .append('g')
            .classed(ScrollableLegend.NavigationArrow.className, true))
            .on('click', (event, d) => {
                const pos = this.legendDataStartIndex;
                this.legendDataStartIndex = d.dataType === 0 /* NavigationArrowType.Increase */
                    ? pos + this.arrowPosWindow : pos - this.arrowPosWindow;
                this.drawLegendInternal(this.data, this.parentViewport, false);
            })
            .attr('transform', (d) => svgManipulation.translate(d.x, d.y));
        let path: d3Selection<any, NavigationArrow, any, any> = arrows.selectAll('path')
            .data((data) => [data]);
        path.exit().remove();
        path = path
            .enter()
            .append('path')
            .merge(path);
        path.attr('d', (d) => d.path)
            .attr('transform', (d) => d.rotateTransform);
    }

    calculateVerticalLayout(dataPoints: ScrollableLegendDataPoint[], title: TitleLayout, navigationArrows: NavigationArrow[], autoWidth: boolean): number {
        // check if we need more space for the margin, or use the default text padding
        const fontSizeBiggerThenDefault = this.legendFontSizeMarginDifference > 0;
        const fontFactor = fontSizeBiggerThenDefault ? this.legendFontSizeMarginDifference : 0;
        // calculate the size needed after font size change
        const verticalLegendHeight = 20 + fontFactor;
        const spaceNeededByTitle = 15 + fontFactor;
        const extraShiftForTextAlignmentToIcon = 4 + fontFactor;
        let totalSpaceOccupiedThusFar = verticalLegendHeight;

        // the default space for text and icon radius + the margin after the font size change
        const firstDataPoint = dataPoints && dataPoints[0];
        const firstDataPointMarkerShape = firstDataPoint && firstDataPoint.seriesMarkerShape;
        const isFirstDataPointLongIcon = firstDataPoint && isLongLegendIconType(firstDataPoint.legendIconType);
        const firstDataPointIconHalfWidth = isFirstDataPointLongIcon
            ? ScrollableLegend.MarkerLineLength
            : this.getMarkerShapeWidth(firstDataPointMarkerShape);
        const fixedHorizontalIconShift = ScrollableLegend.TextAndIconPadding
            + firstDataPointIconHalfWidth / 2
            + this.legendFontSizeMarginDifference;
        const fixedHorizontalTextShift = fixedHorizontalIconShift * 2;
        // check how much space is needed
        const maxHorizontalSpaceAvaliable = autoWidth
            ? this.parentViewport.width * ScrollableLegend.LegendMaxWidthFactor
            - fixedHorizontalTextShift - ScrollableLegend.LegendEdgeMariginWidth
            : this.lastCalculatedWidth
            - fixedHorizontalTextShift - ScrollableLegend.LegendEdgeMariginWidth;
        let numberOfItems = dataPoints.length;
        let maxHorizontalSpaceUsed = 0;
        const parentHeight = this.parentViewport.height;
        if (title) {
            totalSpaceOccupiedThusFar += spaceNeededByTitle;
            title.x = ScrollableLegend.TextAndIconPadding;
            title.y = spaceNeededByTitle;
            maxHorizontalSpaceUsed = title.width || 0;
        }
        // if an arrow should be added, we add space for it
        if (this.legendDataStartIndex > 0)
            totalSpaceOccupiedThusFar += ScrollableLegend.LegendArrowOffset;
        const dataPointsLength = dataPoints.length;
        for (let i = 0; i < dataPointsLength; i++) {
            const dp = dataPoints[i];
            const textProperties = ScrollableLegend.getTextProperties(dp.label, this.data.fontSize, this.data.fontFamily);
            dp.glyphPosition = {
                x: fixedHorizontalIconShift,
                y: (totalSpaceOccupiedThusFar + extraShiftForTextAlignmentToIcon) - textMeasurementService.estimateSvgTextBaselineDelta(textProperties),
            };
            dp.textPosition = {
                x: fixedHorizontalTextShift,
                y: totalSpaceOccupiedThusFar + extraShiftForTextAlignmentToIcon,
            };
            // TODO: [PERF] Get rid of this extra measurement, and modify
            // getTailoredTextToReturnWidth + Text
            const width = textMeasurementService.measureSvgTextWidth(textProperties);
            if (width > maxHorizontalSpaceUsed) {
                maxHorizontalSpaceUsed = width;
            }
            if (width > maxHorizontalSpaceAvaliable) {
                const text = textMeasurementService.getTailoredTextOrDefault(textProperties, maxHorizontalSpaceAvaliable);
                dp.label = text;
            }
            totalSpaceOccupiedThusFar += verticalLegendHeight;
            if (totalSpaceOccupiedThusFar > parentHeight) {
                numberOfItems = i;
                break;
            }
        }
        if (autoWidth) {
            if (maxHorizontalSpaceUsed < maxHorizontalSpaceAvaliable) {
                this.lastCalculatedWidth = this.viewport.width = Math.ceil(maxHorizontalSpaceUsed + fixedHorizontalTextShift + ScrollableLegend.LegendEdgeMariginWidth);
            } else {
                this.lastCalculatedWidth = this.viewport.width = Math.ceil(this.parentViewport.width * ScrollableLegend.LegendMaxWidthFactor);
            }
        } else {
            this.viewport.width = this.lastCalculatedWidth;
        }
        this.visibleLegendHeight = totalSpaceOccupiedThusFar;
        navigationArrows.forEach(d => d.x = this.lastCalculatedWidth / 2);
        this.updateNavigationArrowLayout(navigationArrows, dataPointsLength, numberOfItems);
        return numberOfItems;
    }

    getLegendIconFactor(markerShape: SeriesMarkerShape): number {
        switch (markerShape) {
            case SeriesMarkerShape.circle:
            case SeriesMarkerShape.square: {
                return 5;
            }
            default: {
                return 6;
            }
        }
    }
}

// export declare class SVGLegend {
//     private orientation;
//     private viewport;
//     private parentViewport;
//     private svg;
//     private group;
//     private clearCatcher;
//     private element;
//     private interactivityService;
//     private interactiveBehavior?;
//     private legendDataStartIndex;
//     private arrowPosWindow;
//     private data;
//     private isScrollable;
//     private lastCalculatedWidth;
//     private visibleLegendWidth;
//     private visibleLegendHeight;
//     private legendFontSizeMarginDifference;
//     private legendFontSizeMarginValue;
//     static DefaultFontSizeInPt: number;
//     private static LegendIconRadius;
//     private static MaxTextLength;
//     private static TextAndIconPadding;
//     private static TitlePadding;
//     private static LegendEdgeMariginWidth;
//     private static LegendMaxWidthFactor;
//     private static TopLegendHeight;
//     private static DefaultTextMargin;
//     private static LegendIconYRatio;
//     private static LegendArrowOffset;
//     private static LegendArrowHeight;
//     private static LegendArrowWidth;
//     private static LegendItem;
//     private static LegendText;
//     private static LegendIcon;
//     private static LegendTitle;
//     private static NavigationArrow;
//     constructor(element: HTMLElement, legendPosition: LegendPosition, interactivityService: IInteractivityService<LegendDataPoint>, isScrollable: boolean, interactiveBehavior?: IInteractiveBehavior);
//     private updateLayout;
//     private calculateViewport;
//     getMargins(): powerbi.IViewport;
//     isVisible(): boolean;
//     changeOrientation(orientation: LegendPosition): void;
//     getOrientation(): LegendPosition;
//     drawLegend(data: LegendData, viewport: powerbi.IViewport): void;
//     drawLegendInternal(data: LegendData, viewport: powerbi.IViewport, autoWidth: boolean): void;
//     private static getStrokeDashArrayForLegend;
//     private normalizePosition;
//     private calculateTitleLayout;
//     /** Performs layout offline for optimal perfomance */
//     private calculateLayout;
//     private updateNavigationArrowLayout;
//     private calculateHorizontalNavigationArrowsLayout;
//     private calculateVerticalNavigationArrowsLayout;
//     /**
//      * Calculates the widths for each horizontal legend item.
//      */
//     private static calculateHorizontalLegendItemsWidths;
//     private calculateHorizontalLayout;
//     private getMarkerShapeWidth;
//     private getLegendIconFactor;
//     private getIconScale;
//     private calculateVerticalLayout;
//     private drawNavigationArrows;
//     private isTopOrBottom;
//     private isCentered;
//     reset(): void;
//     private static getTextProperties;
//     private setTooltipToLegendItems;
// }
//
// export class SVGLegend implements ILegend {
//     constructor(element, legendPosition, interactivityService, isScrollable, interactiveBehavior) {
//         this.legendDataStartIndex = 0;
//         this.arrowPosWindow = 1;
//         this.lastCalculatedWidth = 0;
//         this.visibleLegendWidth = 0;
//         this.visibleLegendHeight = 0;
//         this.legendFontSizeMarginDifference = 0;
//         this.legendFontSizeMarginValue = 0;
//         this.svg = select(element)
//             .append("svg")
//             .style("position", "absolute");
//         this.svg.style("display", "inherit");
//         this.svg.classed("legend", true);
//         if (interactivityService) {
//             this.clearCatcher = appendClearCatcher(this.svg);
//         }
//         this.group = this.svg
//             .append("g")
//             .attr("id", "legendGroup");
//         this.interactiveBehavior = interactiveBehavior ? interactiveBehavior : new LegendBehavior();
//         this.interactivityService = interactivityService;
//         this.isScrollable = isScrollable;
//         this.element = element;
//         this.changeOrientation(legendPosition);
//         this.parentViewport = { height: 0, width: 0 };
//         this.calculateViewport();
//         this.updateLayout();
//     }
//     updateLayout() {
//         const legendViewport = this.viewport;
//         const orientation = this.orientation;
//         this.svg.attr("height", legendViewport.height || (orientation === LegendPosition.None ? 0 : this.parentViewport.height));
//         this.svg.attr("width", legendViewport.width || (orientation === LegendPosition.None ? 0 : this.parentViewport.width));
//         const isRight = orientation === LegendPosition.Right || orientation === LegendPosition.RightCenter, isBottom = orientation === LegendPosition.Bottom || orientation === LegendPosition.BottomCenter;
//         this.svg.style("margin-left", isRight ? (this.parentViewport.width - legendViewport.width) + "px" : null);
//         this.svg.style("margin-top", isBottom ? (this.parentViewport.height - legendViewport.height) + "px" : null);
//     }
//     calculateViewport() {
//         switch (this.orientation) {
//             case LegendPosition.Top:
//             case LegendPosition.Bottom:
//             case LegendPosition.TopCenter:
//             case LegendPosition.BottomCenter:
//                 const pixelHeight = PixelConverter.fromPointToPixel(this.data && this.data.fontSize
//                     ? this.data.fontSize
//                     : SVGLegend.DefaultFontSizeInPt);
//                 const fontHeightSize = SVGLegend.TopLegendHeight + (pixelHeight - SVGLegend.DefaultFontSizeInPt);
//                 this.viewport = { height: fontHeightSize, width: 0 };
//                 return;
//             case LegendPosition.Right:
//             case LegendPosition.Left:
//             case LegendPosition.RightCenter:
//             case LegendPosition.LeftCenter:
//                 const width = this.lastCalculatedWidth
//                     ? this.lastCalculatedWidth
//                     : this.parentViewport.width * SVGLegend.LegendMaxWidthFactor;
//                 this.viewport = { height: 0, width: width };
//                 return;
//             case LegendPosition.None:
//                 this.viewport = { height: 0, width: 0 };
//         }
//     }
//     getMargins() {
//         return this.viewport;
//     }
//     isVisible() {
//         return this.orientation !== LegendPosition.None;
//     }
//     changeOrientation(orientation) {
//         if (orientation) {
//             this.orientation = orientation;
//         }
//         else {
//             this.orientation = LegendPosition.Top;
//         }
//         this.svg.attr("orientation", orientation);
//     }
//     getOrientation() {
//         return this.orientation;
//     }
//     drawLegend(data, viewport) {
//         // clone because we modify legend item label with ellipsis if it is truncated
//         const clonedData = Prototype.inherit(data), newDataPoints = [];
//         for (const dp of data.dataPoints) {
//             newDataPoints.push(Prototype.inherit(dp));
//         }
//         clonedData.dataPoints = newDataPoints;
//         this.setTooltipToLegendItems(clonedData);
//         this.drawLegendInternal(clonedData, viewport, true /* perform auto width */);
//     }
//     /* eslint-disable-next-line max-lines-per-function */
//     drawLegendInternal(data, viewport, autoWidth) {
//         this.parentViewport = viewport;
//         this.data = data;
//         if (this.interactivityService)
//             this.interactivityService.applySelectionStateToData(data.dataPoints);
//         if (data.dataPoints.length === 0) {
//             this.changeOrientation(LegendPosition.None);
//         }
//         if (this.getOrientation() === LegendPosition.None) {
//             data.dataPoints = [];
//         }
//         // Adding back the workaround for Legend Left/Right position for Map
//         const mapControls = this.element.getElementsByClassName("mapControl");
//         if (mapControls.length > 0 && !this.isTopOrBottom(this.orientation)) {
//             for (let i = 0; i < mapControls.length; ++i) {
//                 const element = mapControls[i];
//                 element.style.display = "inline-block";
//             }
//         }
//         this.calculateViewport();
//         const layout = this.calculateLayout(data, autoWidth);
//         const titleLayout = layout.title;
//         const titleData = titleLayout ? [titleLayout] : [];
//         const hasSelection = this.interactivityService && dataHasSelection(data.dataPoints);
//         const group = this.group;
//         // transform the wrapping group if position is centered
//         if (this.isCentered(this.orientation)) {
//             let centerOffset = 0;
//             if (this.isTopOrBottom(this.orientation)) {
//                 centerOffset = Math.max(0, (this.parentViewport.width - this.visibleLegendWidth) / 2);
//                 group.attr("transform", svgManipulation.translate(centerOffset, 0));
//             }
//             else {
//                 centerOffset = Math.max((this.parentViewport.height - this.visibleLegendHeight) / 2);
//                 group.attr("transform", svgManipulation.translate(0, centerOffset));
//             }
//         }
//         else {
//             group.attr("transform", null);
//         }
//         const legendTitle = group
//             .selectAll(SVGLegend.LegendTitle.selectorName);
//         const legendTitleData = legendTitle.data(titleData);
//         const enteredLegendTitle = legendTitleData
//             .enter()
//             .append("text")
//             .classed(SVGLegend.LegendTitle.className, true);
//         legendTitleData
//             .merge(enteredLegendTitle)
//             .style("fill", data.labelColor)
//             .style("font-size", PixelConverter.fromPoint(data.fontSize))
//             .style("font-family", data.fontFamily)
//             .text((d) => d.text)
//             .attr("x", (d) => d.x)
//             .attr("y", (d) => d.y)
//             .append("title")
//             .text(data.title);
//         legendTitleData
//             .exit()
//             .remove();
//         const virtualizedDataPoints = data.dataPoints.slice(this.legendDataStartIndex, this.legendDataStartIndex + layout.numberOfItems);
//         const legendItems = group
//             .selectAll(SVGLegend.LegendItem.selectorName)
//             .data(virtualizedDataPoints, (d) => {
//                 return d.identity.getKey() + (d.layerNumber != null ? d.layerNumber : "");
//             });
//         const itemsEnter = legendItems.enter()
//             .append("g")
//             .classed(SVGLegend.LegendItem.className, true);
//         itemsEnter
//             .append("path")
//             .classed(SVGLegend.LegendIcon.className, true);
//         itemsEnter
//             .append("text")
//             .classed(SVGLegend.LegendText.className, true);
//         itemsEnter
//             .append("title")
//             .text((d) => d.tooltip);
//         const mergedLegendIcons = legendItems
//             .merge(itemsEnter)
//             .select(SVGLegend.LegendIcon.selectorName)
//             .attr("transform", (dataPoint) => {
//                 return svgManipulation.translateAndScale(dataPoint.glyphPosition.x, dataPoint.glyphPosition.y, this.getIconScale(dataPoint.markerShape));
//             })
//             .attr("d", (dataPoint) => {
//                 return Markers.getPath(dataPoint.markerShape || MarkerShape.circle);
//             })
//             .attr("stroke-width", (dataPoint) => {
//                 if (dataPoint.lineStyle) {
//                     return 2;
//                 }
//                 return Markers.getStrokeWidth(dataPoint.markerShape || MarkerShape.circle);
//             })
//             .style("fill", (dataPoint) => {
//                 if (dataPoint.lineStyle) {
//                     return null;
//                 }
//                 return dataPoint.color;
//             })
//             .style("stroke", (dataPoint) => dataPoint.color)
//             .style("stroke-dasharray", (dataPoint) => {
//                 if (dataPoint.lineStyle) {
//                     return SVGLegend.getStrokeDashArrayForLegend(dataPoint.lineStyle);
//                 }
//                 return null;
//             })
//             .style("stroke-linejoin", "round");
//         legendItems
//             .merge(itemsEnter)
//             .select("title")
//             .text((dataPoint) => dataPoint.tooltip);
//         const mergedLegendItems = legendItems.merge(itemsEnter);
//         mergedLegendItems
//             .select(SVGLegend.LegendText.selectorName)
//             .attr("x", (dataPoint) => dataPoint.textPosition.x)
//             .attr("y", (dataPoint) => dataPoint.textPosition.y)
//             .text((d) => d.label)
//             .style("fill", data.labelColor)
//             .style("font-size", PixelConverter.fromPoint(data.fontSize))
//             .style("font-family", data.fontFamily);
//         if (this.interactivityService) {
//             const behaviorOptions = {
//                 legendItems: mergedLegendItems,
//                 legendIcons: mergedLegendIcons,
//                 clearCatcher: this.clearCatcher,
//                 dataPoints: data.dataPoints,
//                 behavior: this.interactiveBehavior,
//                 interactivityServiceOptions: {
//                     isLegend: true
//                 }
//             };
//             this.interactivityService.bind(behaviorOptions);
//             this.interactiveBehavior.renderSelection(hasSelection);
//         }
//         legendItems
//             .exit()
//             .remove();
//         this.drawNavigationArrows(layout.navigationArrows);
//         this.updateLayout();
//     }
//     static getStrokeDashArrayForLegend(style) {
//         switch (style) {
//             case LineStyle.dashed: {
//                 return "7,5";
//             }
//             case LineStyle.dotted: {
//                 return "2.5,3.1";
//             }
//             case LineStyle.dotdash: {
//                 return "2.5,3.1,7,3.1";
//             }
//             case LineStyle.dashdot: {
//                 return "7,3.1,2.5,3.1";
//             }
//             case LineStyle.solid: {
//                 return null;
//             }
//         }
//     }
//     normalizePosition(points) {
//         if (this.legendDataStartIndex >= points.length) {
//             this.legendDataStartIndex = points.length - 1;
//         }
//         if (this.legendDataStartIndex < 0) {
//             this.legendDataStartIndex = 0;
//         }
//     }
//     calculateTitleLayout(title) {
//         let width = 0;
//         const hasTitle = !!title;
//         if (hasTitle) {
//             const isHorizontal = this.isTopOrBottom(this.orientation);
//             const textProperties = SVGLegend.getTextProperties(title, this.data.fontSize, this.data.fontFamily);
//             let text = title;
//             width = textMeasurementService.measureSvgTextWidth(textProperties);
//             if (isHorizontal) {
//                 width += SVGLegend.TitlePadding;
//             }
//             else {
//                 text = textMeasurementService.getTailoredTextOrDefault(textProperties, this.viewport.width);
//             }
//             return {
//                 text,
//                 width,
//                 x: 0,
//                 y: 0,
//                 height: textMeasurementService.estimateSvgTextHeight(textProperties)
//             };
//         }
//         return null;
//     }
//     /** Performs layout offline for optimal perfomance */
//     calculateLayout(data, autoWidth) {
//         let dataPoints = data.dataPoints;
//         if (data.dataPoints.length === 0) {
//             return {
//                 numberOfItems: 0,
//                 title: null,
//                 navigationArrows: []
//             };
//         }
//         this.legendFontSizeMarginValue = PixelConverter.fromPointToPixel(this.data && this.data.fontSize !== undefined ? this.data.fontSize : SVGLegend.DefaultFontSizeInPt);
//         this.legendFontSizeMarginDifference = (this.legendFontSizeMarginValue - SVGLegend.DefaultTextMargin);
//         this.normalizePosition(dataPoints);
//         if (this.legendDataStartIndex < dataPoints.length) {
//             dataPoints = dataPoints.slice(this.legendDataStartIndex);
//         }
//         const title = this.calculateTitleLayout(data.title);
//         let navArrows;
//         let numberOfItems;
//         if (this.isTopOrBottom(this.orientation)) {
//             navArrows = this.isScrollable ? this.calculateHorizontalNavigationArrowsLayout(title) : [];
//             numberOfItems = this.calculateHorizontalLayout(dataPoints, title, navArrows);
//         }
//         else {
//             navArrows = this.isScrollable ? this.calculateVerticalNavigationArrowsLayout(title) : [];
//             numberOfItems = this.calculateVerticalLayout(dataPoints, title, navArrows, autoWidth);
//         }
//         return {
//             numberOfItems,
//             title,
//             navigationArrows: navArrows
//         };
//     }
//     updateNavigationArrowLayout(navigationArrows, remainingDataLength, visibleDataLength) {
//         if (this.legendDataStartIndex === 0) {
//             navigationArrows.shift();
//         }
//         const lastWindow = this.arrowPosWindow;
//         this.arrowPosWindow = visibleDataLength;
//         if (navigationArrows && navigationArrows.length > 0 && this.arrowPosWindow === remainingDataLength) {
//             this.arrowPosWindow = lastWindow;
//             navigationArrows.length = navigationArrows.length - 1;
//         }
//     }
//     calculateHorizontalNavigationArrowsLayout(title) {
//         const height = SVGLegend.LegendArrowHeight;
//         const width = SVGLegend.LegendArrowWidth;
//         const translateY = (this.viewport.height / 2) - (height / 2);
//         const data = [];
//         const rightShift = title ? title.x + title.width : 0;
//         const arrowLeft = svgManipulation.createArrow(width, height, 180 /*angle*/);
//         const arrowRight = svgManipulation.createArrow(width, height, 0 /*angle*/);
//         data.push({
//             x: rightShift,
//             y: translateY,
//             path: arrowLeft.path,
//             rotateTransform: arrowLeft.transform,
//             dataType: 1 /* NavigationArrowType.Decrease */
//         });
//         data.push({
//             x: this.parentViewport.width - width,
//             y: translateY,
//             path: arrowRight.path,
//             rotateTransform: arrowRight.transform,
//             dataType: 0 /* NavigationArrowType.Increase */
//         });
//         return data;
//     }
//     calculateVerticalNavigationArrowsLayout(title) {
//         const height = SVGLegend.LegendArrowHeight;
//         const width = SVGLegend.LegendArrowWidth;
//         const verticalCenter = this.viewport.height / 2;
//         const data = [];
//         const rightShift = verticalCenter + height / 2;
//         const arrowTop = svgManipulation.createArrow(width, height, 270 /*angle*/);
//         const arrowBottom = svgManipulation.createArrow(width, height, 90 /*angle*/);
//         const titleHeight = title ? title.height : 0;
//         data.push({
//             x: rightShift,
//             y: width + titleHeight,
//             path: arrowTop.path,
//             rotateTransform: arrowTop.transform,
//             dataType: 1 /* NavigationArrowType.Decrease */
//         });
//         data.push({
//             x: rightShift,
//             y: this.parentViewport.height - height,
//             path: arrowBottom.path,
//             rotateTransform: arrowBottom.transform,
//             dataType: 0 /* NavigationArrowType.Increase */
//         });
//         return data;
//     }
//     /**
//      * Calculates the widths for each horizontal legend item.
//      */
//     static calculateHorizontalLegendItemsWidths(dataPoints, availableWidth, iconPadding, fontSize, fontFamily) {
//         const dataPointsLength = dataPoints.length;
//         // Set the maximum amount of space available to each item. They can use less, but can"t go over this number.
//         let maxItemWidth = dataPointsLength > 0 ? availableWidth / dataPointsLength | 0 : 0;
//         let maxItemTextWidth = maxItemWidth - iconPadding;
//         // Makes sure the amount of space available to each item is at least SVGLegend.MaxTextLength wide.
//         // If you had many items and/or a narrow amount of available width, the availableTextWidthPerItem would be small, essentially making everything ellipsis.
//         // This prevents that from happening by giving each item at least SVGLegend.MaxTextLength of space.
//         if (maxItemTextWidth < SVGLegend.MaxTextLength) {
//             maxItemTextWidth = SVGLegend.MaxTextLength;
//             maxItemWidth = maxItemTextWidth + iconPadding;
//         }
//         // Make sure the availableWidthPerItem is less than the availableWidth. This lets the long text properly add ellipsis when we"re displaying one item at a time.
//         if (maxItemWidth > availableWidth) {
//             maxItemWidth = availableWidth;
//             maxItemTextWidth = maxItemWidth - iconPadding;
//         }
//         let occupiedWidth = 0;
//         const legendItems = [];
//         // Add legend items until we can"t fit any more (the last one doesn"t fit) or we"ve added all of them
//         for (const dataPoint of dataPoints) {
//             const textProperties = SVGLegend.getTextProperties(dataPoint.label, fontSize, fontFamily);
//             const itemTextWidth = textMeasurementService.measureSvgTextWidth(textProperties);
//             const desiredWidth = itemTextWidth + iconPadding;
//             const overMaxWidth = desiredWidth > maxItemWidth;
//             const actualWidth = overMaxWidth ? maxItemWidth : desiredWidth;
//             occupiedWidth += actualWidth;
//             if (occupiedWidth >= availableWidth) {
//                 // Always add at least 1 element
//                 if (legendItems.length === 0) {
//                     legendItems.push({
//                         dataPoint: dataPoint,
//                         textProperties: textProperties,
//                         desiredWidth: desiredWidth,
//                         desiredOverMaxWidth: true,
//                         width: desiredWidth
//                     });
//                     // Set the width to the amount of space we actually have
//                     occupiedWidth = availableWidth;
//                 }
//                 else {
//                     // Subtract the width from what was just added since it won"t fit
//                     occupiedWidth -= actualWidth;
//                 }
//                 break;
//             }
//             legendItems.push({
//                 dataPoint: dataPoint,
//                 textProperties: textProperties,
//                 desiredWidth: desiredWidth,
//                 desiredOverMaxWidth: overMaxWidth,
//                 width: desiredWidth
//             });
//         }
//         // If there are items at max width, evenly redistribute the extra space to them
//         const itemsOverMax = legendItems.filter((li) => li.desiredOverMaxWidth);
//         let numItemsOverMax = itemsOverMax.length;
//         if (numItemsOverMax > 0) {
//             let extraWidth = availableWidth - occupiedWidth;
//             for (const item of itemsOverMax) {
//                 // Divvy up the extra space and add it to the max
//                 // We need to do this calculation in every loop since the remainingWidth may not be changed by the same amount every time
//                 const extraWidthPerItem = extraWidth / numItemsOverMax;
//                 const newMaxItemWidth = maxItemWidth + extraWidthPerItem;
//                 let usedExtraWidth;
//                 if (item.desiredWidth <= newMaxItemWidth) {
//                     // If the item doesn"t need all the extra space, it"s not at max anymore
//                     item.desiredOverMaxWidth = false;
//                     usedExtraWidth = item.desiredWidth - maxItemWidth;
//                 }
//                 else {
//                     // Otherwise the item is taking up all the extra space so update the actual width to indicate that
//                     item.width = newMaxItemWidth;
//                     usedExtraWidth = newMaxItemWidth - maxItemWidth;
//                 }
//                 extraWidth -= usedExtraWidth;
//                 numItemsOverMax--;
//             }
//         }
//         return legendItems;
//     }
//     calculateHorizontalLayout(dataPoints, title, navigationArrows) {
//         const fontSizeBiggerThanDefault = this.legendFontSizeMarginDifference > 0;
//         const fontSizeMargin = fontSizeBiggerThanDefault
//             ? SVGLegend.TextAndIconPadding + this.legendFontSizeMarginDifference
//             : SVGLegend.TextAndIconPadding;
//         let occupiedWidth = 0;
//         const firstDataPointMarkerShape = dataPoints && dataPoints[0] && dataPoints[0].markerShape;
//         const iconTotalItemPadding = this.getMarkerShapeWidth(firstDataPointMarkerShape) + fontSizeMargin * 1.5;
//         let numberOfItems = dataPoints.length;
//         // get the Y coordinate which is the middle of the container + the middle of the text height - the delta of the text
//         const defaultTextProperties = SVGLegend.getTextProperties("", this.data.fontSize, this.data.fontFamily);
//         const verticalCenter = this.viewport.height / 2;
//         const textYCoordinate = verticalCenter + textMeasurementService.estimateSvgTextHeight(defaultTextProperties) / 2
//             - textMeasurementService.estimateSvgTextBaselineDelta(defaultTextProperties);
//         if (title) {
//             occupiedWidth += title.width;
//             // get the Y coordinate which is the middle of the container + the middle of the text height - the delta of the text
//             title.y = verticalCenter
//                 + title.height / 2
//                 - textMeasurementService.estimateSvgTextBaselineDelta(SVGLegend.getTextProperties(title.text, this.data.fontSize, this.data.fontFamily));
//         }
//         // if an arrow should be added, we add space for it
//         if (this.legendDataStartIndex > 0) {
//             occupiedWidth += SVGLegend.LegendArrowOffset;
//         }
//         // Calculate the width for each of the legend items
//         const dataPointsLength = dataPoints.length;
//         let availableWidth = this.parentViewport.width - occupiedWidth;
//         let legendItems = SVGLegend.calculateHorizontalLegendItemsWidths(dataPoints, availableWidth, iconTotalItemPadding, this.data.fontSize, this.data.fontFamily);
//         numberOfItems = legendItems.length;
//         // If we can"t show all the legend items, subtract the "next" arrow space from the available space and re-run the width calculations
//         if (numberOfItems !== dataPointsLength) {
//             availableWidth -= SVGLegend.LegendArrowOffset;
//             legendItems = SVGLegend.calculateHorizontalLegendItemsWidths(dataPoints, availableWidth, iconTotalItemPadding, this.data.fontSize, this.data.fontFamily);
//             numberOfItems = legendItems.length;
//         }
//         for (const legendItem of legendItems) {
//             const { dataPoint } = legendItem;
//             const markerShapeWidth = this.getMarkerShapeWidth(dataPoint.markerShape);
//             dataPoint.glyphPosition = {
//                 // the space taken so far + the radius + the margin / radiusFactor to prevent huge spaces
//                 x: occupiedWidth + markerShapeWidth / 2 + (this.legendFontSizeMarginDifference / this.getLegendIconFactor(dataPoint.markerShape)),
//                 // The middle of the container but a bit lower due to text not being in the middle (qP for example making middle between q and P)
//                 y: this.viewport.height * SVGLegend.LegendIconYRatio,
//             };
//             const fixedTextShift = (fontSizeMargin / (this.getLegendIconFactor(dataPoint.markerShape) / 2)) + markerShapeWidth;
//             dataPoint.textPosition = {
//                 x: occupiedWidth + fixedTextShift,
//                 y: textYCoordinate,
//             };
//             // If we're over the max width, process it so it fits
//             if (legendItem.desiredOverMaxWidth) {
//                 const textWidth = legendItem.width - iconTotalItemPadding;
//                 dataPoint.label = textMeasurementService.getTailoredTextOrDefault(legendItem.textProperties, textWidth);
//             }
//             occupiedWidth += legendItem.width;
//         }
//         this.visibleLegendWidth = occupiedWidth;
//         this.updateNavigationArrowLayout(navigationArrows, dataPointsLength, numberOfItems);
//         return numberOfItems;
//     }
//     getMarkerShapeWidth(markerShape) {
//         switch (markerShape) {
//             case MarkerShape.longDash: {
//                 return Markers.LegendIconLineTotalWidth;
//             }
//             default: {
//                 return SVGLegend.LegendIconRadius * 2;
//             }
//         }
//     }
//     getLegendIconFactor(markerShape) {
//         switch (markerShape) {
//             case MarkerShape.circle:
//             case MarkerShape.square: {
//                 return 5;
//             }
//             default: {
//                 return 6;
//             }
//         }
//     }
//     getIconScale(markerShape) {
//         switch (markerShape) {
//             case MarkerShape.circle:
//             case MarkerShape.square: {
//                 return SVGLegend.LegendIconRadius / Markers.defaultSize;
//             }
//             default: {
//                 return 1;
//             }
//         }
//     }
//     calculateVerticalLayout(dataPoints, title, navigationArrows, autoWidth) {
//         // check if we need more space for the margin, or use the default text padding
//         const fontSizeBiggerThenDefault = this.legendFontSizeMarginDifference > 0;
//         const fontFactor = fontSizeBiggerThenDefault ? this.legendFontSizeMarginDifference : 0;
//         // calculate the size needed after font size change
//         const verticalLegendHeight = 20 + fontFactor;
//         const spaceNeededByTitle = 15 + fontFactor;
//         const extraShiftForTextAlignmentToIcon = 4 + fontFactor;
//         let totalSpaceOccupiedThusFar = verticalLegendHeight;
//         // the default space for text and icon radius + the margin after the font size change
//         const firstDataPointMarkerShape = dataPoints && dataPoints[0] && dataPoints[0].markerShape;
//         const fixedHorizontalIconShift = SVGLegend.TextAndIconPadding
//             + this.getMarkerShapeWidth(firstDataPointMarkerShape) / 2
//             + this.legendFontSizeMarginDifference;
//         const fixedHorizontalTextShift = fixedHorizontalIconShift * 2;
//         // check how much space is needed
//         const maxHorizontalSpaceAvaliable = autoWidth
//             ? this.parentViewport.width * SVGLegend.LegendMaxWidthFactor
//             - fixedHorizontalTextShift - SVGLegend.LegendEdgeMariginWidth
//             : this.lastCalculatedWidth
//             - fixedHorizontalTextShift - SVGLegend.LegendEdgeMariginWidth;
//         let numberOfItems = dataPoints.length;
//         let maxHorizontalSpaceUsed = 0;
//         const parentHeight = this.parentViewport.height;
//         if (title) {
//             totalSpaceOccupiedThusFar += spaceNeededByTitle;
//             title.x = SVGLegend.TextAndIconPadding;
//             title.y = spaceNeededByTitle;
//             maxHorizontalSpaceUsed = title.width || 0;
//         }
//         // if an arrow should be added, we add space for it
//         if (this.legendDataStartIndex > 0)
//             totalSpaceOccupiedThusFar += SVGLegend.LegendArrowOffset;
//         const dataPointsLength = dataPoints.length;
//         for (let i = 0; i < dataPointsLength; i++) {
//             const dp = dataPoints[i];
//             const textProperties = SVGLegend.getTextProperties(dp.label, this.data.fontSize, this.data.fontFamily);
//             dp.glyphPosition = {
//                 x: fixedHorizontalIconShift,
//                 y: (totalSpaceOccupiedThusFar + extraShiftForTextAlignmentToIcon) - textMeasurementService.estimateSvgTextBaselineDelta(textProperties)
//             };
//             dp.textPosition = {
//                 x: fixedHorizontalTextShift,
//                 y: totalSpaceOccupiedThusFar + extraShiftForTextAlignmentToIcon
//             };
//             // TODO: [PERF] Get rid of this extra measurement, and modify
//             // getTailoredTextToReturnWidth + Text
//             const width = textMeasurementService.measureSvgTextWidth(textProperties);
//             if (width > maxHorizontalSpaceUsed) {
//                 maxHorizontalSpaceUsed = width;
//             }
//             if (width > maxHorizontalSpaceAvaliable) {
//                 const text = textMeasurementService.getTailoredTextOrDefault(textProperties, maxHorizontalSpaceAvaliable);
//                 dp.label = text;
//             }
//             totalSpaceOccupiedThusFar += verticalLegendHeight;
//             if (totalSpaceOccupiedThusFar > parentHeight) {
//                 numberOfItems = i;
//                 break;
//             }
//         }
//         if (autoWidth) {
//             if (maxHorizontalSpaceUsed < maxHorizontalSpaceAvaliable) {
//                 this.lastCalculatedWidth = this.viewport.width = Math.ceil(maxHorizontalSpaceUsed + fixedHorizontalTextShift + SVGLegend.LegendEdgeMariginWidth);
//             }
//             else {
//                 this.lastCalculatedWidth = this.viewport.width = Math.ceil(this.parentViewport.width * SVGLegend.LegendMaxWidthFactor);
//             }
//         }
//         else {
//             this.viewport.width = this.lastCalculatedWidth;
//         }
//         this.visibleLegendHeight = totalSpaceOccupiedThusFar;
//         navigationArrows.forEach(d => d.x = this.lastCalculatedWidth / 2);
//         this.updateNavigationArrowLayout(navigationArrows, dataPointsLength, numberOfItems);
//         return numberOfItems;
//     }
//     drawNavigationArrows(layout) {
//         let arrows = this.group.selectAll(SVGLegend.NavigationArrow.selectorName)
//             .data(layout);
//         arrows.exit().remove();
//         arrows = arrows.merge(arrows
//             .enter()
//             .append("g")
//             .classed(SVGLegend.NavigationArrow.className, true))
//             .on("click", (event, d) => {
//                 const pos = this.legendDataStartIndex;
//                 this.legendDataStartIndex = d.dataType === 0 /* NavigationArrowType.Increase */
//                     ? pos + this.arrowPosWindow : pos - this.arrowPosWindow;
//                 this.drawLegendInternal(this.data, this.parentViewport, false);
//             })
//             .attr("transform", (d) => svgManipulation.translate(d.x, d.y));
//         let path = arrows.selectAll("path")
//             .data((data) => [data]);
//         path.exit().remove();
//         path = path
//             .enter()
//             .append("path")
//             .merge(path);
//         path.attr("d", (d) => d.path)
//             .attr("transform", (d) => d.rotateTransform);
//     }
//     isTopOrBottom(orientation) {
//         switch (orientation) {
//             case LegendPosition.Top:
//             case LegendPosition.Bottom:
//             case LegendPosition.BottomCenter:
//             case LegendPosition.TopCenter:
//                 return true;
//             default:
//                 return false;
//         }
//     }
//     isCentered(orientation) {
//         switch (orientation) {
//             case LegendPosition.BottomCenter:
//             case LegendPosition.LeftCenter:
//             case LegendPosition.RightCenter:
//             case LegendPosition.TopCenter:
//                 return true;
//             default:
//                 return false;
//         }
//     }
//     /* eslint-disable-next-line @typescript-eslint/no-empty-function */
//     reset() { }
//     static getTextProperties(text, fontSize, fontFamily) {
//         return {
//             fontFamily,
//             fontSize: PixelConverter.fromPoint(fontSize || SVGLegend.DefaultFontSizeInPt),
//             text,
//         };
//     }
//     setTooltipToLegendItems(data) {
//         // we save the values to tooltip before cut
//         for (const dataPoint of data.dataPoints) {
//             dataPoint.tooltip = dataPoint.label;
//         }
//     }
// }
// SVGLegend.DefaultFontSizeInPt = 8;
// SVGLegend.LegendIconRadius = 5;
// SVGLegend.MaxTextLength = 60;
// SVGLegend.TextAndIconPadding = 5;
// SVGLegend.TitlePadding = 15;
// SVGLegend.LegendEdgeMariginWidth = 10;
// SVGLegend.LegendMaxWidthFactor = 0.3;
// SVGLegend.TopLegendHeight = 24;
// SVGLegend.DefaultTextMargin = PixelConverter.fromPointToPixel(SVGLegend.DefaultFontSizeInPt);
// SVGLegend.LegendIconYRatio = 0.52;
// // Navigation Arrow constants
// SVGLegend.LegendArrowOffset = 10;
// SVGLegend.LegendArrowHeight = 15;
// SVGLegend.LegendArrowWidth = 7.5;
// SVGLegend.LegendItem = createClassAndSelector("legendItem");
// SVGLegend.LegendText = createClassAndSelector("legendText");
// SVGLegend.LegendIcon = createClassAndSelector("legendIcon");
// SVGLegend.LegendTitle = createClassAndSelector("legendTitle");
// SVGLegend.NavigationArrow = createClassAndSelector("navArrow");
// //# sourceMappingURL=svgLegend.js.map
