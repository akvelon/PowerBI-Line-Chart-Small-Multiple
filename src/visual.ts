'use strict';

import powerbi from 'powerbi-visuals-api';
import {
    CategoryType,
    d3Selection,
    LineDataPoint,
    LineKeyIndex,
    VerticalLineDataItemsGlobalWithKey,
    VisualDataPoint,
    VisualDomain,
    VisualViewModel,
} from './visualInterfaces';
import {
    DefaultSeparator,
    LegendSettings,
    MaximumSizeEndValue,
    MaximumSizeStartValue,
    MinCategoryWidthEndValue,
    MinCategoryWidthStartValue,
    MinStrokeWidth,
    NiceDateFormat,
    PrecisionMinValue,
    VisualSettings,
} from './settings';
import {select as d3select} from 'd3-selection';
import {
    createInteractivitySelectionService,
} from 'powerbi-visuals-utils-interactivityutils/lib/interactivitySelectionService';
import {IInteractivityService} from 'powerbi-visuals-utils-interactivityutils/lib/interactivityBaseService';
import {LegendBehavior} from './legendBehavior';
import {LegendPosition} from 'powerbi-visuals-utils-chartutils/lib/legend/legendInterfaces';
import {createTooltipServiceWrapper, ITooltipServiceWrapper} from 'powerbi-visuals-utils-tooltiputils';
import {WebBehavior, WebBehaviorOptions} from './behavior';
import {createClassAndSelector} from 'powerbi-visuals-utils-svgutils/lib/cssConstants';
import {IValueFormatter} from 'powerbi-visuals-utils-formattingutils/lib/src/valueFormatter';
import {Formatter} from './utilities/vizUtility';
import {getLegendData, positionChartArea, renderLegend, retrieveLegendCategoryColumn} from './utilities/legendUtility';

import '../style/visual.less';
import {RenderVisual} from './renderVisual';
import {EnumerateObject} from './utilities/objectEnumerationUtility';
import {SeriesMarkerShape} from './seriesMarkerShape';
import {IMargin} from 'powerbi-visuals-utils-svgutils';
import {createLegend, IScrollableLegend, ScrollableLegendDataPoint} from './utilities/scrollableLegend';
import IVisual = powerbi.extensibility.visual.IVisual;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataView = powerbi.DataView;
import VisualUpdateType = powerbi.VisualUpdateType;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import ValueTypeDescriptor = powerbi.ValueTypeDescriptor;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import ISelectionIdBuilder = powerbi.extensibility.ISelectionIdBuilder;
import ISelectionId = powerbi.extensibility.ISelectionId;
import DataViewObjects = powerbi.DataViewObjects;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import {implementLassoSelection} from './lasso';

function formatDrillDownXAxisValue(category: DataViewCategoryColumn, i: number, locale: string): string {
    let format = category.source.format;
    let categoryValue: PrimitiveValue;
    if (category.source.type && category.source.type.dateTime) {
        format = format ? format : NiceDateFormat;
        categoryValue = new Date(category.values[i].toString());
    } else {
        categoryValue = category.values[i];
    }
    const formatter: IValueFormatter = Formatter.getFormatter({
        format: format,
        cultureSelector: locale,
    });

    return formatter.format(categoryValue);
}

function retrieveCategoryType(categoryIsScalar, categoryIsDate, categoryIsBoolean): CategoryType {
    if ((categoryIsBoolean && categoryIsScalar) || (categoryIsBoolean && categoryIsDate) || (categoryIsScalar && categoryIsDate)) {
        return CategoryType.Error;
    }

    return (categoryIsScalar)
        ? CategoryType.Number
        : ((categoryIsDate)
            ? CategoryType.Date
            : ((categoryIsBoolean)
                ? CategoryType.Boolean
                : CategoryType.String));
}

function sortNumberLegend(a: ScrollableLegendDataPoint, b: ScrollableLegendDataPoint) {
    return sortNumber(+(a.tooltip ?? 0), +(b.tooltip ?? 0));
}

function sortDateLegend(a: ScrollableLegendDataPoint, b: ScrollableLegendDataPoint) {
    const a1: Date = new Date(a.tooltip ?? '');
    const b1: Date = new Date(b.tooltip ?? '');
    return a1.getTime() - b1.getTime();
}

function sortNumber(a, b) {
    const a1: number = +a;
    const b1: number = +b;
    return a1 - b1;
}

function sortDate(a, b) {
    const a1: Date = new Date(a.toString());
    const b1: Date = new Date(b.toString());
    return a1.getTime() - b1.getTime();
}

function get_sorted(array: any[], type: ValueTypeDescriptor | undefined): PrimitiveValue[] {
    let result: PrimitiveValue[] = [];
    if (array) {
        result = (type && type.numeric)
            ? array.sort(sortNumber)
            : ((type && type.dateTime)
                ? array.sort(sortDate)
                : array.sort());
    }
    return result;
}

export class Visual implements IVisual {
    private host: IVisualHost;
    private model: VisualViewModel;
    private element: d3Selection<any>;
    private interactivityService: IInteractivityService<any>;
    private legend: IScrollableLegend;
    private tooltipServiceWrapper: ITooltipServiceWrapper;
    private behavior: WebBehavior;
    private legendBehavior: LegendBehavior;

    public static SmallMultipleSelector = createClassAndSelector('customSM');
    public static SimpleLineSelector = createClassAndSelector('simpleLine');
    public static InteractivityLineSelector = createClassAndSelector('interactivity-line');
    public static DotSelector = createClassAndSelector('dot');
    public static MarkerLineSelector = createClassAndSelector('markerLine');
    public static CircleSelector = createClassAndSelector('circle-item');
    public static HoverLineSelector = createClassAndSelector('hover-line');
    public static LassoRectSelector = createClassAndSelector('lasso-rect');
    public static LassoSvgSelector = createClassAndSelector('lasso-svg');
    public static LineChartRectSelector = createClassAndSelector('line-chart-rect');
    public static SmallMultipleNameSelector = createClassAndSelector('sm-name');
    public static Label = createClassAndSelector('data-label');
    public static NavigationArrow = createClassAndSelector('navArrow');
    public static NavigationArrowCustomLeft = createClassAndSelector('navArrowCustomLeft');
    public static NavigationArrowCustomRight = createClassAndSelector('navArrowCustomRight');
    public static AxisGraphicsContextSelector = createClassAndSelector('axisGraphicsContext');
    public static AxisLabelSelector = createClassAndSelector('axisLabel');
    public static LassoDataSelectorId: string = 'lasso-data';

    constructor(options: VisualConstructorOptions) {
        try {
            console.log('=== CONSTRUCTOR ===');

            this.host = options.host;
            this.model = {
                rows: [],
                columns: [],
                rowsFormat: '',
                columnsFormat: '',
                categories: [],
                dataPoints: [],
                legendDataPoint: [],
                lines: [],
                lineKeyIndex: {},
                categoryName: '',
                valuesName: '',
                categoryIsDate: false,
                categoryFormat: '',
                valueFormat: '',
                legendFormatter: null,
                legendType: CategoryType.String,
                categoryIsScalar: false,
                domain: {startForced: false, endForced: false},
                settings: VisualSettings.getDefault() as VisualSettings,
            };
            this.element = d3select(options.element);
            this.interactivityService = createInteractivitySelectionService(options.host);
            this.legendBehavior = new LegendBehavior();
            this.legend = createLegend(options.element, this.interactivityService, true, LegendPosition.Top, this.legendBehavior);
            this.tooltipServiceWrapper = createTooltipServiceWrapper(
                options.host.tooltipService,
                options.element);
            this.behavior = new WebBehavior();

            console.log('=== CONSTRUCTOR END ===');
        } catch (e) {
            console.error('=== CONSTRUCTOR ERROR ===');
            console.error(e);
            throw e;
        }
    }

    // eslint-disable-next-line max-lines-per-function
    public update(options: VisualUpdateOptions) {
        try {
            console.log('=== UPDATE START ===');

            this.model = visualTransform(options, this.host);
            this.element.selectAll('div, svg:not(.legend)').remove();
            if (this.model.categories.length == 0) return;
            this.legendBehavior.addLegendData(this.model.settings.legend, this.model.legendDataPoint);
            let margin: IMargin = {top: 0, left: 0, bottom: 0, right: 0};

            //Legend
            renderLegend(this.model.settings.legend, this.model.legendDataPoint, this.legend, options, margin);
            let containerSize = {
                width: options.viewport.width - margin.left - margin.right,
                height: options.viewport.height - margin.top - margin.bottom,
            };

            let container: d3Selection<any> = this.element
                .append('div')
                .classed('chart', true)
                .style('width', containerSize.width + 'px')
                .style('height', containerSize.height + 'px');

            positionChartArea(container, this.legend);
            this.interactivityService.applySelectionStateToData(this.model.lines);

            const renderSimpleVisual = new RenderVisual(this.host, this.element, this.model, this.model.domain, this.interactivityService, this.tooltipServiceWrapper);

            const rowNumber: number = (this.model.rows.length == 0) ? 1 : this.model.rows.length;
            const columnsNumber: number = (this.model.columns.length == 0) ? 1 : this.model.columns.length;

            this.model.settings.smallMultiple.enable = rowNumber > 1 || columnsNumber > 1;
            if (!this.model.settings.smallMultiple.enable)
                if ((this.model.settings.xAxis.minCategoryWidth ?? 0) < this.model.settings.xAxis.fontSize)
                    this.model.settings.xAxis.minCategoryWidth = this.model.settings.xAxis.fontSize;

            const titleHeight: number = this.model.settings.smallMultiple.fontSize * 2;
            const separatorSize = 20;

            const separatorIndex = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.showSeparators) ? 1 : 0;
            const titleIndex = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.showChartTitle) ? 1 : 0;
            const matrixFlowIndex = (this.model.settings.smallMultiple.enable) ? 1 : 0;

            const minItemWidth: number = matrixFlowIndex
                ? this.model.settings.smallMultiple.minUnitWidth
                : containerSize.width;
            const matrixIndex: number = (this.model.settings.smallMultiple.enable && this.model.settings.smallMultiple.layoutMode == 'Matrix') ? 1 : 0;
            let itemWidth: number = Math.max((containerSize.width - titleHeight * matrixIndex * titleIndex) / columnsNumber - separatorSize * matrixFlowIndex, minItemWidth);

            if (!matrixFlowIndex && !this.model.settings.general.responsive) {
                container.style('overflow-x', 'auto')
                    .style('overflow-y', 'hidden');
                const MinWidhtForNotResponsive: number = 200;
                if (itemWidth < MinWidhtForNotResponsive) {
                    containerSize.height = containerSize.height - 20;
                    itemWidth = MinWidhtForNotResponsive;
                }
            }

            const minItemHeight: number = matrixFlowIndex ? this.model.settings.smallMultiple.minUnitHeigth : containerSize.height;
            const columnTitleIndex: number = (this.model.columns.length > 0) ? titleIndex : 0;
            let itemHeight: number = matrixIndex
                ? Math.max((containerSize.height - separatorSize - titleHeight * columnTitleIndex) / rowNumber - separatorSize, minItemHeight)
                : Math.max((containerSize.height - separatorSize - 5) / rowNumber - titleHeight * titleIndex - separatorSize, minItemHeight);

            let selectionLines: LineDataPoint[] = [];
            const dots: LineDataPoint[] = [];

            if (matrixFlowIndex)
                this.model.settings.xAxis.minCategoryWidth = null;
            if (this.model.settings.xAxis.axisType === 'categorical' && !matrixFlowIndex) {
                const maxCountOfXAxis: number = renderSimpleVisual.retrieveMaxCountOfXAxis(this.model.lines);
                const maxWidth: number = maxCountOfXAxis * (this.model.settings.xAxis.minCategoryWidth ?? 0);
                itemWidth = (itemWidth > maxWidth) ? itemWidth : maxWidth;
            }

            let lassoContainer: d3Selection<any>;

            if (this.model.settings.smallMultiple.enable) {
                container.style('overflow', 'auto');
                switch (this.model.settings.smallMultiple.layoutMode) {
                    case 'Matrix': {
                        const rowHeight: number = itemHeight + separatorSize;
                        const matrixWidth: number = itemWidth * columnsNumber + separatorSize * (columnsNumber - 1);
                        const rowTitleIndex: number = (this.model.rows.length > 0) ? titleIndex : 0;

                        const smContainer: d3Selection<any> = container.append('svg')
                            .attr('width', matrixWidth + titleHeight * titleIndex)
                            .attr('height', rowHeight * rowNumber + titleHeight * columnTitleIndex);
                        smContainer.append('rect')
                            .classed('clearCatcher', true)
                            .attr('width', '100%')
                            .attr('height', '100%');
                        lassoContainer = smContainer;
                        lassoContainer.append('svg').attr('id', Visual.LassoDataSelectorId);
                        for (let i = 0; i < rowNumber; i++) {
                            const translateY: number = (i == 0)
                                ? 0
                                : i * rowHeight + titleHeight * columnTitleIndex;
                            const matrixTitleIndex = (i == 0) && (columnTitleIndex == 1) ? 1 : 0;
                            const rowContainer: d3Selection<any> = smContainer
                                .append('g')
                                .attr('width', matrixWidth + titleIndex * rowTitleIndex)
                                .attr('height', rowHeight + titleHeight * matrixTitleIndex)
                                .attr('transform', 'translate(0,' + translateY + ')');
                            if (titleIndex == 1 && this.model.rows.length > 0) {
                                const maxTextWidth: number = rowHeight + titleHeight * matrixTitleIndex;
                                const titleX: string = this.formatSmallMultipleTitle(this.model.rows[i], this.model.rowsFormat, this.host.locale);
                                renderSimpleVisual.renderRowTitleForMatrixView(rowContainer, titleHeight, maxTextWidth, separatorSize, titleX, i, separatorIndex);
                            }

                            for (let j = 0; j < columnsNumber; j++) {
                                const lineKey: string = this.retrieveLineKey(i, j);
                                const lines: LineDataPoint[] = this.retrieveLines(lineKey);
                                for (let k = 0; k < lines.length; k++) {
                                    selectionLines.push(lines[k]);
                                    if (lines[k].points && lines[k].points.length == 1)
                                        dots.push(lines[k]);
                                }

                                const titleY: string = (this.model.columns.length > 0)
                                    ? this.formatSmallMultipleTitle(this.model.columns[j], this.model.columnsFormat, this.host.locale)
                                    : '';

                                const translateX: number = (itemWidth + separatorSize) * j + titleHeight * rowTitleIndex;
                                const rowItemHeight: number = (i == rowNumber - 1) ? rowHeight - separatorSize : rowHeight + titleHeight * matrixTitleIndex;
                                const itemContainer: d3Selection<SVGElement> = rowContainer
                                    .append('g')
                                    .attr('width', itemWidth)
                                    .attr('height', rowItemHeight)
                                    .attr('transform', 'translate(' + translateX + ',0)');

                                if (i == 0 && titleY != '') {
                                    renderSimpleVisual.renderSmallMultipleWithTitle(itemContainer, itemWidth, itemHeight, titleHeight, titleY, lines, lineKey, translateX, translateY);
                                } else {
                                    renderSimpleVisual.renderSmallMultiple(itemContainer, lines, itemWidth, itemHeight, lineKey, false, 0, false, translateX, translateY);
                                }

                                //show row separator
                                if (i < rowNumber - 1) {
                                    const columnSeparatorY: number = itemHeight + titleHeight * matrixTitleIndex;
                                    const rowSeparator: d3Selection<any> = itemContainer.append('g')
                                        .attr('width', itemWidth)
                                        .attr('height', separatorSize)
                                        .attr('transform', 'translate(0,' + columnSeparatorY + ')');
                                    RenderVisual.renderSeparatorLine(rowSeparator, 0, separatorSize / 2, itemWidth, separatorSize / 2, separatorIndex);
                                }

                                //show column separator
                                if (j < columnsNumber - 1) {
                                    const columnSeparatorX: number = translateX + itemWidth;
                                    const columnSeparator: d3Selection<any> = rowContainer.append('g')
                                        .attr('width', separatorSize)
                                        .attr('height', rowHeight + titleHeight * matrixTitleIndex)
                                        .attr('transform', 'translate(' + columnSeparatorX + ',0)');
                                    RenderVisual.renderSeparatorLine(columnSeparator, separatorSize / 2, 0, separatorSize / 2, rowHeight + titleHeight * matrixTitleIndex, separatorIndex);
                                    if (i < rowNumber - 1) {
                                        const separatorY = itemHeight + titleHeight * matrixTitleIndex + separatorSize / 2;
                                        RenderVisual.renderSeparatorLine(columnSeparator, 0, separatorY, separatorSize, separatorY, separatorIndex);
                                    }
                                }
                            }
                        }
                        break;
                    }

                    case 'Flow': {
                        const containerDevideCount = Math.floor((containerSize.width + separatorSize) / (itemWidth + separatorSize));
                        let itemCountForRow: number = (containerDevideCount < this.model.settings.smallMultiple.minRowWidth)
                            ? this.model.settings.smallMultiple.minRowWidth
                            : containerDevideCount;
                        itemCountForRow = Math.floor(columnsNumber / itemCountForRow)
                            ? itemCountForRow
                            : columnsNumber % itemCountForRow;
                        const rowHeight: number = (columnsNumber % itemCountForRow)
                            ? (itemHeight + titleHeight * titleIndex + separatorSize) * (Math.floor(columnsNumber / itemCountForRow) + 1)
                            : (itemHeight + titleHeight * titleIndex + separatorSize) * Math.floor(columnsNumber / itemCountForRow);
                        const rowHeights: number[] = [];
                        let rowSumHeight: number = 0;
                        let rowItemHeight: number;
                        const showEmptySmallMultiples: boolean = this.model.settings.smallMultiple.showEmptySmallMultiples;
                        let maxColumnsNumber: number = showEmptySmallMultiples ? columnsNumber : 0;
                        for (let i = 0; i < rowNumber; i++) {
                            if (showEmptySmallMultiples) {
                                rowItemHeight = rowHeight;
                            } else {
                                let columnsNumber1: number = 0;
                                for (let j = 0; j < columnsNumber; j++) {
                                    const lineKey: string = this.retrieveLineKey(i, j);
                                    const lines: LineDataPoint[] = this.retrieveLines(lineKey);
                                    if (lines.length > 0)
                                        columnsNumber1 = columnsNumber1 + 1;
                                }
                                if (maxColumnsNumber < columnsNumber1)
                                    maxColumnsNumber = columnsNumber1;
                                rowItemHeight = (columnsNumber1 % itemCountForRow)
                                    ? (itemHeight + titleHeight * titleIndex + separatorSize) * (Math.floor(columnsNumber1 / itemCountForRow) + 1)
                                    : (itemHeight + titleHeight * titleIndex + separatorSize) * Math.floor(columnsNumber1 / itemCountForRow);
                            }
                            rowHeights.push(rowItemHeight);
                            rowSumHeight = rowSumHeight + rowItemHeight + separatorSize;
                        }

                        if (itemCountForRow < maxColumnsNumber) {
                            maxColumnsNumber = itemCountForRow;
                        }

                        itemWidth = Math.max(itemWidth, (containerSize.width - separatorSize) / maxColumnsNumber - separatorSize);
                        const flowWidth: number = Math.max(containerSize.width, (itemWidth + separatorSize) * maxColumnsNumber - separatorSize);
                        const smContainer: d3Selection<any> = container.append('svg')
                            .attr('width', flowWidth)
                            .attr('height', rowSumHeight - separatorSize);
                        smContainer.append('rect')
                            .classed('clearCatcher', true)
                            .attr('width', '100%')
                            .attr('height', '100%');
                        lassoContainer = smContainer;
                        lassoContainer.append('svg').attr('id', Visual.LassoDataSelectorId);
                        let oldRowItemHeight: number = 0;
                        for (let i = 0; i < rowNumber; i++) {
                            rowItemHeight = rowHeights[i];
                            const translateY = oldRowItemHeight;
                            oldRowItemHeight = translateY + rowItemHeight + separatorSize;
                            const rowContainer: d3Selection<any> = smContainer
                                .append('g')
                                .attr('width', flowWidth)
                                .attr('height', rowItemHeight)
                                .attr('transform', 'translate(0,' + translateY + ')');
                            let j1: number = -1;
                            for (let j = 0; j < columnsNumber; j++) {
                                const lineKey: string = this.retrieveLineKey(i, j);
                                const lines: LineDataPoint[] = this.retrieveLines(lineKey);
                                if (lines.length == 0 && !showEmptySmallMultiples) {
                                    continue;
                                }

                                j1 = j1 + 1;
                                const j2: number = showEmptySmallMultiples ? j : j1;
                                for (let k = 0; k < lines.length; k++) {
                                    selectionLines.push(lines[k]);
                                    if (lines[k].points && lines[k].points.length == 1) {
                                        dots.push(lines[k]);
                                    }
                                }

                                const title: string = this.getTitle(i, j, this.model.rowsFormat, this.model.columnsFormat, this.host.locale);

                                const translateItemX: number = (j2 % itemCountForRow) * (itemWidth + separatorSize);
                                const translateItemY: number = Math.floor(j2 / itemCountForRow) * (itemHeight + titleHeight * titleIndex + separatorSize);
                                const itemContainer: d3Selection<SVGElement> = rowContainer
                                    .append('g')
                                    .attr('width', itemWidth)
                                    .attr('height', itemHeight + titleHeight * titleIndex)
                                    .attr('transform', 'translate(' + translateItemX + ',' + translateItemY + ')');
                                renderSimpleVisual.renderSmallMultipleWithTitle(itemContainer, itemWidth, itemHeight, titleHeight, title, lines, lineKey, translateItemX, translateY + translateItemY);
                            }

                            if (separatorIndex && i < rowNumber - 1) {
                                const translateSeparatorY: number = translateY + rowItemHeight;
                                const rowSeparator: d3Selection<any> = smContainer.append('g')
                                    .attr('width', flowWidth)
                                    .attr('height', separatorSize)
                                    .attr('transform', 'translate(0,' + translateSeparatorY + ')');
                                RenderVisual.renderSeparatorLine(rowSeparator, 0, separatorSize / 2, (itemWidth + separatorSize) * itemCountForRow, separatorSize / 2, separatorIndex);
                            }
                        }
                        break;
                    }
                }
            } else {
                //simple view
                const scrollbarMargin: number = 25;
                if (itemWidth > containerSize.width)
                    itemHeight = itemHeight - scrollbarMargin;
                let svgContainer: d3Selection<SVGElement> = container
                    .append('svg')
                    .attr('width', itemWidth)
                    .attr('height', itemHeight);
                const lineKey: string = this.retrieveLineKey(0, 0);
                const lines: LineDataPoint[] = this.retrieveLines(lineKey);
                selectionLines = lines;
                for (let k = 0; k < lines.length; k++) {
                    if (lines[k].points && lines[k].points.length == 1)
                        dots.push(lines[k]);
                }

                let legendPosition: string = this.model.settings.legend.position;
                let legendHeight: number = margin.top;
                let newLegendPosition: string | null = null;
                let svgContainerWidth: number = itemWidth;
                let svgContainerHeight: number = itemHeight;
                let stepCount: number = 0;
                const maxStepCount: number = this.model.settings.general.responsive ? 2 : 0;
                while (stepCount < maxStepCount && legendPosition != 'None') {
                    newLegendPosition = renderSimpleVisual.retrieveNewLegendPosition(svgContainer, lines, svgContainerWidth, svgContainerHeight, legendPosition, legendHeight);
                    const legendSettings: LegendSettings = {
                        show: this.model.settings.legend.show,
                        position: newLegendPosition,
                        showTitle: this.model.settings.legend.showTitle,
                        legendName: this.model.settings.legend.legendName,
                        legendNameColor: this.model.settings.legend.legendNameColor,
                        fontFamily: this.model.settings.legend.fontFamily,
                        fontSize: this.model.settings.legend.fontSize,
                        style: this.model.settings.legend.style,
                        matchLineColor: this.model.settings.legend.matchLineColor,
                        circleDefaultIcon: this.model.settings.legend.circleDefaultIcon,
                    };
                    if (newLegendPosition == 'None') {
                        this.model.settings.legend.position = 'None';
                    }

                    margin = {top: 0, left: 0, bottom: 0, right: 0};
                    renderLegend(legendSettings, this.model.legendDataPoint, this.legend, options, margin);
                    legendHeight = this.retrieveLegendHeight(legendHeight, legendPosition, margin);
                    containerSize = {
                        width: options.viewport.width - margin.left - margin.right,
                        height: options.viewport.height - margin.top - margin.bottom,
                    };
                    this.element.selectAll('.chart').remove();
                    svgContainerWidth = Math.max(itemWidth, containerSize.width);
                    svgContainerHeight = Math.max(itemHeight, containerSize.height);
                    container = this.element
                        .append('div')
                        .classed('chart', true)
                        .style('width', containerSize.width + 'px')
                        .style('height', containerSize.height + 'px');
                    positionChartArea(container, this.legend);
                    container
                        .style('overflow-x', 'auto')
                        .style('overflow-y', 'hidden');
                    if (svgContainerWidth > containerSize.width)
                        svgContainerHeight = svgContainerHeight - scrollbarMargin;

                    svgContainer = container
                        .append('svg')
                        .attr('width', svgContainerWidth)
                        .attr('height', svgContainerHeight);

                    if (legendPosition == newLegendPosition) {
                        break;
                    }

                    legendPosition = newLegendPosition;
                    stepCount = stepCount + 1;
                }

                const isLegendHidden: boolean = (legendPosition == 'None');
                svgContainer.append('svg').attr('id', Visual.LassoDataSelectorId);
                renderSimpleVisual.renderSmallMultiple(svgContainer, lines, svgContainerWidth, svgContainerHeight, lineKey,
                    this.model.settings.general.responsive, legendHeight, isLegendHidden, 0, 0);
                lassoContainer = svgContainer;
            }

            //selection
            const legendContainer: d3Selection<any> = this.element.select('.legend');
            const verticalLineDataItemsGlobal: VerticalLineDataItemsGlobalWithKey = renderSimpleVisual.verticalLineDataItemsGlobal;

            const behaviorOptions: WebBehaviorOptions = {
                dataPoints: this.model.dataPoints,
                selectionLines,
                lineGroupSelection: container.selectAll(Visual.SimpleLineSelector.selectorName).data(selectionLines),
                markerLineGroupSelection: container.selectAll(Visual.MarkerLineSelector.selectorName).data(selectionLines),
                interactiveLineGroupSelection: container.selectAll(Visual.InteractivityLineSelector.selectorName).data(selectionLines),
                dotsSelection: container.selectAll(Visual.DotSelector.selectorName).data(dots),
                container,
                tooltipServiceWrapper: this.tooltipServiceWrapper,
                verticalLineDataItemsGlobal,
                legendBehavior: this.legendBehavior,
                legendDataPoints: this.model.legendDataPoint,
                legendFormatter: this.model.legendFormatter,
                legendType: this.model.legendType,
                shapes: this.model.settings.shapes,
                behavior: this.behavior,
            };

            this.interactivityService.bind(behaviorOptions);

            const clearContainer: d3Selection<any> = lassoContainer.selectAll('.clearCatcher,' + Visual.SmallMultipleNameSelector.selectorName);
            const behavior: WebBehavior = this.behavior;
            clearContainer.on('click', function () {
                behavior.clearCather();
            });
            //lasso
            const lassoColor: string = this.model.settings.selectionColor.fill;
            implementLassoSelection(this.element, lassoContainer, this.model.dataPoints, this.model.lines, matrixFlowIndex, lassoColor, legendContainer,
                this.interactivityService, this.behavior, verticalLineDataItemsGlobal, this.model.settings.shapes, this.model.legendFormatter, this.model.legendType);
            //start legend changing by click
            const legendBehavior = this.legendBehavior;
            const legendPosition: string = this.model.settings.legend.position;
            const is = this.interactivityService;
            if (legendPosition == 'Top' || legendPosition == 'TopCenter' || legendPosition == 'Bottom' || legendPosition == 'BottomCenter') {
                const hasSelection: boolean = is.hasSelection();
                legendBehavior.renderSelection(hasSelection);
            }

            console.log('=== UPDATE END ===');
        } catch (e) {
            console.error('=== UPDATE ERROR ===');
            console.error(e);
            throw e;
        }
    }

    private formatSmallMultipleTitle(value: PrimitiveValue, format: string, locale: string): string {
        const isDate: boolean = !isNaN(+Date.parse(value.toString()));
        if (isDate) {
            format = format ? format : NiceDateFormat;
            value = new Date(value.toString());
        }
        const formatter: IValueFormatter = Formatter.getFormatter({
            format: format,
            cultureSelector: locale,
        });

        return formatter.format(value);
    }

    private retrieveLegendHeight(legendHeight: number, legendPosition: string, margin: any) {
        if (legendPosition == 'Top' || legendPosition == 'TopCenter')
            legendHeight = margin.top;
        if (legendPosition == 'Bottom' || legendPosition == 'BottomCenter')
            legendHeight = margin.bottom;
        return legendHeight;
    }

    private retrieveLineKey(i: number, j: number): string {
        return i + DefaultSeparator + j + DefaultSeparator;
    }

    private retrieveLines(lineKey: string): LineDataPoint[] {
        const lines: LineDataPoint[] = [];
        for (let k = 0; k < this.model.legendDataPoint.length; k++) {
            const key: string = lineKey + this.model.legendDataPoint[k].tooltip;
            const lineIndex: number = this.model.lineKeyIndex[key];
            const lineDataPoint: LineDataPoint = this.model.lines[lineIndex];
            if (lineDataPoint)
                lines.push(lineDataPoint);
        }

        return lines;
    }

    private getTitle(i: number, j: number, rowsFormat: string, columnsFormat: string, locale: string): string {
        const title: string = (this.model.rows.length > 0)
            ? ((this.model.columns.length > 0)
                ? this.formatSmallMultipleTitle(this.model.rows[i], rowsFormat, locale) + ', ' + this.formatSmallMultipleTitle(this.model.columns[j], columnsFormat, locale)
                : this.formatSmallMultipleTitle(this.model.rows[i], rowsFormat, locale))
            : ((this.model.columns.length > 0)
                ? this.formatSmallMultipleTitle(this.model.columns[j], columnsFormat, locale)
                : '');
        return title;
    }

    public static parseSettings(dataView: DataView): VisualSettings {
        return VisualSettings.parse(dataView) as VisualSettings;
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstanceEnumeration {
        const instanceEnumeration: VisualObjectInstanceEnumeration = VisualSettings.enumerateObjectInstances(this.model.settings, options);
        EnumerateObject.setInstances(this.model.settings, instanceEnumeration, this.model);
        return instanceEnumeration;
    }
}

// eslint-disable-next-line max-lines-per-function
function visualTransform(options: VisualUpdateOptions, host: IVisualHost): VisualViewModel | null {
    //Get DataViews
    const dataViews = options.dataViews;
    const hasDataViews = (dataViews && dataViews[0]);
    const hasCategoricalData = (hasDataViews && dataViews[0].categorical && dataViews[0].categorical.values);

    const dataView: DataView = options && options.dataViews && options.dataViews[0];
    if (!dataView || options.type === VisualUpdateType.ResizeEnd) {
        return null;
    }

    const settings = Visual.parseSettings(dataView);

    //Limit some properties
    if (settings.shapes.strokeWidth < MinStrokeWidth) settings.shapes.strokeWidth = MinStrokeWidth;
    if (settings.xAxis.strokeWidth < MinStrokeWidth) settings.xAxis.strokeWidth = MinStrokeWidth;
    if (settings.yAxis.strokeWidth < MinStrokeWidth) settings.yAxis.strokeWidth = MinStrokeWidth;
    if (settings.xAxis.precision < PrecisionMinValue) settings.xAxis.precision = PrecisionMinValue;
    if (settings.yAxis.precision < PrecisionMinValue) settings.yAxis.precision = PrecisionMinValue;
    if (settings.dataLabels.precision < PrecisionMinValue) settings.dataLabels.precision = PrecisionMinValue;
    if (settings.xAxis.maximumSize < MaximumSizeStartValue) settings.xAxis.maximumSize = MaximumSizeStartValue;
    if (settings.xAxis.maximumSize > MaximumSizeEndValue) settings.xAxis.maximumSize = MaximumSizeEndValue;
    if (settings.xAxis.minCategoryWidth < MinCategoryWidthStartValue) settings.xAxis.minCategoryWidth = MinCategoryWidthStartValue;
    if (settings.xAxis.minCategoryWidth > MinCategoryWidthEndValue) settings.xAxis.minCategoryWidth = MinCategoryWidthEndValue;

    //Get DataPoints
    const domain: VisualDomain = {startForced: false, endForced: false, start: 0, end: 0};
    if (settings.yAxis.chartRangeType == 'custom') {
        if (settings.yAxis.start !== null) {
            domain.start = settings.yAxis.start;
            domain.startForced = true;
        }
        if (settings.yAxis.end !== null) {
            domain.end = settings.yAxis.end;
            domain.endForced = true;
        }
    }

    let rowsData: PrimitiveValue[] = [];
    let columnsData: PrimitiveValue[] = [];
    let rowsFormat: string = '';
    let columnsFormat: string = '';
    let categoryData: PrimitiveValue[] = [];
    let categoryName: string = '';
    let valuesName: string = '';
    const dataPoints: VisualDataPoint[] = [];
    let legendDataPoint: ScrollableLegendDataPoint[] = [];
    const lines: LineDataPoint[] = [];
    const lineKeyIndex: LineKeyIndex = {};
    let categoryIsDate: boolean = false;
    let categoryFormat: string | undefined = undefined;
    let valueFormat: string | null = null;
    let legendFormatter: IValueFormatter | null = null;
    let legendType: CategoryType = CategoryType.String;
    let categoryIsScalar: boolean = false;

    if (hasCategoricalData) {
        const dataCategorical = dataViews[0].categorical;
        const category: DataViewCategoryColumn[] = [];
        let row: DataViewCategoryColumn | null = null;
        let column: DataViewCategoryColumn | null = null;
        let categoryLength: number = 0;
        if (dataCategorical?.categories) {
            for (let i = 0; i < dataCategorical.categories.length; i++) {
                const item: DataViewCategoryColumn = dataCategorical.categories[i];
                categoryLength = item.values.length;
                if (item.source.roles?.['Category']) {
                    categoryName = categoryName + item.source.displayName + ' ';
                    category.push(item);
                }
                if (item.source.roles?.['Row']) {
                    rowsFormat = item.source.format ?? rowsFormat;
                    row = item;
                }
                if (item.source.roles?.['Column']) {
                    columnsFormat = item.source.format ?? columnsFormat;
                    column = item;
                }
            }
        }

        let categorySourceType: CategoryType = CategoryType.String;
        if (category.length == 1) {
            categoryFormat = category[0].source.format;
            let categoryIsBoolean: boolean = false;
            const type = category[0].source.type;
            if (type) {
                categoryIsDate = type.dateTime ?? false;
                categoryIsScalar = type.numeric ?? false;
                categoryIsBoolean = type.bool ?? false;
            }

            categorySourceType = retrieveCategoryType(categoryIsScalar, categoryIsDate, categoryIsBoolean);
            if (categorySourceType == CategoryType.Date && !categoryFormat)
                categoryFormat = NiceDateFormat;
            if (categorySourceType != CategoryType.Number && categorySourceType != CategoryType.Date) {
                settings.xAxis.axisType = 'categorical';
            }
        } else if (category.length > 1) {
            categorySourceType = CategoryType.String;
            settings.xAxis.axisType = 'categorical';
        }

        let categoryDataKeys: string[] = [];
        let rowKeys: string[] = [];
        let columnKeys: string[] = [];
        for (let i = 0; i < categoryLength; i++) {
            let item: PrimitiveValue;
            let key: string;
            if (category.length > 0) {
                if (category.length == 1) {
                    item = category[0].values[i];
                } else {
                    item = '';
                    for (let cI = 0; cI < category.length; cI++) {
                        const formattedValue: string = formatDrillDownXAxisValue(category[cI], i, host.locale);
                        item = item + formattedValue + ' ';
                    }
                }
                key = item.toString();
                if (categoryDataKeys.indexOf(key) == -1) {
                    categoryDataKeys.push(key);
                    categoryData.push(item);
                }
            }

            if (row != null) {
                item = row.values[i];
                key = item.toString();
                if (rowKeys.indexOf(key) == -1) {
                    rowKeys.push(key);
                    rowsData.push(item);
                }
            }

            if (column != null) {
                item = column.values[i];
                key = item.toString();
                if (columnKeys.indexOf(key) == -1) {
                    columnKeys.push(key);
                    columnsData.push(item);
                }
            }
        }

        categoryDataKeys = [];
        rowKeys = [];
        columnKeys = [];
        rowsData = (row != null) ? get_sorted(rowsData, row.source.type) : [];
        columnsData = (column != null) ? get_sorted(columnsData, column.source.type) : [];

        const legendData = getLegendData(dataView, host, settings.legend);
        if (settings.legend.legendName == null)
            settings.legend.legendName = legendData.title;
        legendDataPoint = legendData.dataPoints;

        let legendFormat: string = null;
        if (legendDataPoint.length > 0) {
            const columns: DataViewMetadataColumn[] = dataView.metadata.columns;
            let legendValueType: ValueTypeDescriptor = null;
            for (let i = 0; i < columns.length; i++) {
                const column: DataViewMetadataColumn = columns[i];
                if (column.roles['Legend']) {
                    legendFormat = column.format;
                    legendValueType = column.type;
                    break;
                }
                if (column.roles['Values'] && !column.groupName) {
                    valuesName = valuesName + column.displayName + ' ';
                }
            }
            if (legendValueType) {
                legendType = retrieveCategoryType(legendValueType.numeric, legendValueType.dateTime, legendValueType.bool);
            } else {
                let legendIsBoolean: boolean = false;
                if (legendDataPoint.length == 2) {
                    const labels: string[] = [legendDataPoint[0].tooltip.toLowerCase(), legendDataPoint[1].tooltip.toLowerCase()];
                    if (labels.indexOf('false') != -1 && labels.indexOf('true') != -1) {
                        legendIsBoolean = true;
                        legendType = CategoryType.Boolean;
                    }
                }
                if (!legendIsBoolean) {
                    const item: string = legendDataPoint[0].tooltip;
                    const legendIsNumber: boolean = !isNaN(+item);
                    if (legendIsNumber) {
                        legendType = CategoryType.Number;
                    } else {
                        const legendIsDate: boolean = !isNaN(+Date.parse(item));
                        if (legendIsDate)
                            legendType = CategoryType.Date;
                    }
                }
            }
        }
        switch (legendType) {
            case CategoryType.Number: {
                legendFormatter = Formatter.getFormatter({
                    format: legendFormat,
                    value: 0,
                    precision: null,
                    displayUnitSystemType: 0,
                    cultureSelector: host.locale,
                });
                for (let i = 0; i < legendDataPoint.length; i++) {
                    legendDataPoint[i].label = legendFormatter.format(legendDataPoint[i].tooltip);
                }
                break;
            }
            case CategoryType.Date: {
                legendFormat = legendFormat ? legendFormat : NiceDateFormat;
                legendFormatter = Formatter.getFormatter({
                    format: legendFormat,
                    cultureSelector: host.locale,
                });
                for (let i = 0; i < legendDataPoint.length; i++) {
                    const d: Date = new Date(legendDataPoint[i].tooltip);
                    legendDataPoint[i].label = legendFormatter.format(d);
                }
                break;
            }
            case CategoryType.Boolean: {
                legendFormatter = Formatter.getFormatter({
                    format: legendFormat,
                    cultureSelector: host.locale,
                });
                for (let i = 0; i < legendDataPoint.length; i++) {
                    legendDataPoint[i].label = legendFormatter.format(legendDataPoint[i].tooltip);
                }
                break;
            }
            case CategoryType.String: {
                legendFormatter = null;
                break;
            }
        }

        const legendItemIndexForNameKey: object = {};
        for (let i = 0; i < legendDataPoint.length; i++) {
            legendItemIndexForNameKey[legendDataPoint[i].tooltip] = i;
        }

        const tooltipsDataViewValueColumns: DataViewValueColumn[] = [];
        for (let ii = 0; ii < dataCategorical.values.length; ii++) {
            const dataValue: DataViewValueColumn = dataCategorical.values[ii];
            if (dataValue.source.roles['Tooltips']) {
                tooltipsDataViewValueColumns.push(dataValue);
            }
        }
        const legendColumn: DataViewCategoryColumn = retrieveLegendCategoryColumn(dataView);
        const newLegendDataPoint: ScrollableLegendDataPoint[] = [];
        const existedLegendNames: string[] = [];
        for (let ii = 0; ii < dataCategorical.values.length; ii++) {
            const dataValue: DataViewValueColumn = dataCategorical.values[ii];
            if (dataValue.source.roles['Values']) {
                if (ii == 0) {
                    valueFormat = dataValue.source.format;
                }
                for (let i = 0; i < dataValue.values.length; i++) {
                    let value: PrimitiveValue = dataValue.values[i];
                    const highlights: boolean = value == null
                        ? false
                        : ((dataValue.highlights != null)
                            ? dataValue.highlights[i] != null
                            : true);
                    if (highlights) {
                        value = +value;
                        const displayName: string = dataValue.source.groupName != null
                            ? dataValue.source.groupName.toString()
                            : (legendColumn && legendColumn.values
                                ? legendColumn.values[i].toString()
                                : dataValue.source.displayName);
                        //generate key
                        let rowIndex = 0;
                        if (row != null) {
                            const rowValue: PrimitiveValue = row.values[i];
                            rowIndex = rowsData.indexOf(rowValue);
                        }
                        let columnIndex = 0;
                        if (column != null) {
                            const columnValue: PrimitiveValue = column.values[i];
                            columnIndex = columnsData.indexOf(columnValue);
                        }
                        const lineKey: string = rowIndex + DefaultSeparator + columnIndex + DefaultSeparator;
                        //domain
                        if (!domain.startForced)
                            domain.start = (domain.start !== undefined ? Math.min(domain.start, value) : value);
                        if (!domain.endForced)
                            domain.end = (domain.end !== undefined ? Math.max(domain.end, value) : value);
                        //linePoint
                        let lineIndex: number = lineKeyIndex[lineKey + displayName];
                        let lineDataPoint: LineDataPoint = (lineIndex != undefined)
                            ? lines[lineIndex]
                            : null;

                        //generate tooltips
                        const legendDataPointIndex: number = legendItemIndexForNameKey[displayName];
                        const legendDataPointItem: ScrollableLegendDataPoint = legendDataPoint[legendDataPointIndex];
                        const color: string = legendDataPointItem.color;
                        let tooltipName: string = legendDataPointItem.tooltip;
                        if (existedLegendNames.indexOf(tooltipName) == -1) {
                            existedLegendNames.push(tooltipName);
                            newLegendDataPoint.push(legendDataPointItem);
                        }
                        switch (legendType) {
                            case CategoryType.Number: {
                                tooltipName = legendFormatter.format(+tooltipName);
                                break;
                            }
                            case CategoryType.Date: {
                                const item: Date = new Date(tooltipName);
                                tooltipName = legendFormatter.format(item);
                                break;
                            }
                        }
                        let xValue: PrimitiveValue;
                        switch (category.length) {
                            case 0: {
                                xValue = '';
                                break;
                            }
                            case 1: {
                                xValue = category[0].values[i];
                                break;
                            }
                            default: {
                                xValue = '';
                                for (let cI = 0; cI < category.length; cI++) {
                                    const formattedValue: string = formatDrillDownXAxisValue(category[cI], i, host.locale);
                                    xValue = xValue + formattedValue + ' ';
                                }
                                break;
                            }
                        }
                        const tooltipFormatter = Formatter.getFormatter({
                            format: dataValue.source.format,
                            value: 0,
                            precision: null,
                            displayUnitSystemType: 0,
                            cultureSelector: host.locale,
                        });
                        const tooltip: VisualTooltipDataItem = {
                            displayName: tooltipName,
                            value: tooltipFormatter.format(value),
                            color: color,
                        };
                        const tooltips: VisualTooltipDataItem[] = [tooltip];
                        for (let k = 0; k < tooltipsDataViewValueColumns.length; k++) {
                            const tooltipDataValueColumn: DataViewValueColumn = tooltipsDataViewValueColumns[k];
                            const tooltipName: string = tooltipDataValueColumn.source.groupName != null
                                ? tooltipDataValueColumn.source.groupName.toString()
                                : displayName;
                            if (tooltipName == displayName) {
                                let tooltipValue: PrimitiveValue = tooltipDataValueColumn.values[i];
                                const tooltipValueIsDate: boolean = !isNaN(+Date.parse(tooltipValue.toString()));
                                let format: string = tooltipDataValueColumn.source.format;
                                if (tooltipValueIsDate) {
                                    tooltipValue = new Date(tooltipValue.toString());
                                    format = format ? format : NiceDateFormat;
                                }
                                const formatter = Formatter.getFormatter({
                                    format: format,
                                    precision: null,
                                    displayUnitSystemType: 0,
                                    cultureSelector: host.locale,
                                });
                                const tooltip: VisualTooltipDataItem = {
                                    displayName: tooltipDataValueColumn.source.displayName,
                                    value: formatter.format(tooltipValue),
                                };
                                tooltips.push(tooltip);
                            }
                        }
                        //generate dataPoint
                        let selectionIdBuilder: ISelectionIdBuilder = host.createSelectionIdBuilder();
                        for (let cI = 0; cI < category.length; cI++) {
                            selectionIdBuilder = selectionIdBuilder.withCategory(category[cI], i);
                        }
                        const dataPointIdentity: ISelectionId = legendDataPoint.length > 2
                            ? selectionIdBuilder
                                .withSeries(dataCategorical.values, dataValue)
                                .withMeasure(dataValue.source.queryName)
                                .createSelectionId()
                            : selectionIdBuilder
                                .withMeasure(dataValue.source.queryName)
                                .createSelectionId();
                        const dataPoint: VisualDataPoint = {
                            x: xValue,
                            y: value,
                            tooltips: tooltips,
                            lineKey: lineKey + displayName,
                            selected: false,
                            identity: dataPointIdentity,
                        };
                        dataPoints.push(dataPoint);
                        if (lineDataPoint) {
                            lineDataPoint.points.push(dataPoint);
                        } else {
                            const object: DataViewObjects = legendDataPointItem.object;
                            const identity: ISelectionId = legendDataPointItem.identity;

                            lineDataPoint = {
                                lineKey: lineKey + displayName,
                                name: displayName,
                                points: [dataPoint],
                                color: color,
                                identity: identity,
                                selected: false,
                            };

                            const objectShapesDefined: boolean = (object != undefined) && (object.shapes != undefined);
                            if (objectShapesDefined && settings.shapes.customizeSeries) {
                                if (object.shapes.seriesStrokeWidth != undefined)
                                    lineDataPoint.strokeWidth = +object.shapes.seriesStrokeWidth;
                                if (object.shapes.seriesStrokeLineJoin != undefined)
                                    lineDataPoint.strokeLineJoin = object.shapes.seriesStrokeLineJoin.toString();
                                if (object.shapes.seriesLineStyle != undefined)
                                    lineDataPoint.lineStyle = object.shapes.seriesLineStyle.toString();
                                if (object.shapes.seriesStepped != undefined)
                                    lineDataPoint.stepped = object.shapes.seriesStepped == true;
                                if (object.shapes.seriesShowMarkers != undefined)
                                    lineDataPoint.showMarkers = object.shapes.seriesShowMarkers == true;
                                if (object.shapes.seriesMarkerShape != undefined)
                                    lineDataPoint.seriesMarkerShape = object.shapes.seriesMarkerShape as SeriesMarkerShape;
                                if (object.shapes.seriesMarkerSize != undefined)
                                    lineDataPoint.markerSize = +object.shapes.seriesMarkerSize;
                                if (object.shapes.seriesMarkerColor != undefined) {
                                    const colorMarkerShapes: string = object.shapes.seriesMarkerColor['solid'].color;
                                    lineDataPoint.markerColor = colorMarkerShapes;
                                    if (lineDataPoint.markerColor == '')
                                        lineDataPoint.markerColor = color;
                                }
                            }

                            const letShowMarkers: boolean = (lineDataPoint.showMarkers == true || (lineDataPoint.showMarkers == null && settings.shapes.showMarkers));
                            const markerColor: string = lineDataPoint.markerColor ? lineDataPoint.markerColor : settings.shapes.markerColor;
                            legendDataPointItem.color = markerColor ? markerColor : color;
                            legendDataPointItem.showMarkers = letShowMarkers;
                            legendDataPointItem.seriesMarkerShape = lineDataPoint.seriesMarkerShape ? lineDataPoint.seriesMarkerShape : settings.shapes.markerShape;
                            legendDataPoint[legendDataPointIndex] = legendDataPointItem;

                            lineIndex = lines.push(lineDataPoint);
                            lineKeyIndex[lineKey + displayName] = lineIndex - 1;
                        }
                    }
                }
            }
        }
        legendDataPoint = newLegendDataPoint;

        if (lines.length > 0 && categoryData.length == 0) {
            settings.xAxis.axisType = 'categorical';
            categoryIsScalar = false;
            categoryIsDate = false;
            categorySourceType = CategoryType.String;
            categoryData = [''];
        }
        if (settings.xAxis.axisType == 'continuous') {
            switch (categorySourceType) {
                case CategoryType.Number: {
                    categoryData = categoryData.sort(sortNumber);
                    legendDataPoint = legendDataPoint.sort(sortNumberLegend);
                    break;
                }
                case CategoryType.Date: {
                    categoryData = categoryData.sort(sortDate);
                    legendDataPoint = legendDataPoint.sort(sortDateLegend);
                    break;
                }
            }
            for (let i = 0; i < legendDataPoint.length; i++) {
                legendDataPoint[i].showMarkers = false;
            }
        }
    }

    if (!domain.start) domain.start = 0;
    if (!domain.end) domain.end = 0;
    if (domain.start > domain.end)
        domain.end = domain.start;
    //sort data points
    for (let i = 0; i < lines.length; i++) {
        const points: any[] = lines[i].points;
        const newPoints: any[] = [];
        for (let j = 0; j < categoryData.length; j++) {
            const categoryString: string = categoryData[j].toString();
            let k: number = 0;
            while (k < points.length) {
                const pointCategoryString: string = points[k].x.toString();
                if (categoryString == pointCategoryString) {
                    newPoints.push(points[k]);
                    break;
                }
                k = k + 1;
            }
            if (points.length == newPoints.length)
                break;
        }
        lines[i].points = newPoints;
    }

    if (settings.xAxis.axisType !== 'categorical') {
        settings.shapes.showMarkers = false;
    }

    if (settings.shapes.customizeSeries) {
        if (settings.shapes.series == '') {
            settings.shapes.series = legendDataPoint[0].label;
        }
    }

    return {
        rows: rowsData,
        columns: columnsData,
        rowsFormat: rowsFormat,
        columnsFormat: columnsFormat,
        categories: categoryData,
        categoryName: categoryName,
        valuesName: valuesName,
        dataPoints: dataPoints,
        legendDataPoint: legendDataPoint,
        lines: lines,
        lineKeyIndex: lineKeyIndex,
        categoryIsDate: categoryIsDate,
        categoryFormat: categoryFormat,
        valueFormat: valueFormat,
        categoryIsScalar: categoryIsScalar,
        legendFormatter: legendFormatter,
        legendType: legendType,
        domain: domain,
        settings: settings,
    };
}
