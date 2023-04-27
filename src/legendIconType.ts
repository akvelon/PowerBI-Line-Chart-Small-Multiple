export const enum LegendIconType {
    markers = 'markers',
    lineMarkers = 'linemarkers',
    line = 'line',
}

export function isLongLegendIconType(type: LegendIconType) {
    return type == LegendIconType.line || type == LegendIconType.lineMarkers;
}
