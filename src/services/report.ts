import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import type {
  Experiment,
  ExperimentStats,
  SignificanceResult,
  ReportData,
} from '../types'
import { generateRecommendation } from './stats'

export function generateReportData(
  experiment: Experiment,
  stats: ExperimentStats,
  significance: SignificanceResult | null
): ReportData {
  return {
    experiment,
    stats,
    significance,
    recommendation: generateRecommendation(experiment, stats, significance),
    generatedAt: Date.now(),
  }
}

export async function exportReportPDF(report: ReportData): Promise<void> {
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  let y = 20

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('A/B 测试实验报告', pageWidth / 2, y, { align: 'center' })
  y += 15

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`, 14, y)
  y += 15

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('一、实验概述', 14, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const exp = report.experiment

  const summaryLines = [
    `实验名称: ${exp.name}`,
    `实验描述: ${exp.description || '无'}`,
    `实验状态: ${getExperimentStatusText(exp.status)}`,
    `开始日期: ${exp.startDate}`,
    `结束日期: ${exp.endDate || '未设置'}`,
    `目标事件: ${exp.goalEvent}`,
    `变体数量: ${exp.variants.length}`,
    `当前放量: ${exp.trafficAllocation.rolloutPercentage}%`,
  ]

  for (const line of summaryLines) {
    doc.text(line, 14, y)
    y += 7
  }
  y += 10

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('二、变体数据对比', 14, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('变体名称', 14, y)
  doc.text('访问量', 70, y)
  doc.text('独立访客', 100, y)
  doc.text('转化量', 130, y)
  doc.text('转化率', 160, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  for (const stat of report.stats.variantStats) {
    doc.text(stat.variantName.substring(0, 15), 14, y)
    doc.text(String(stat.visits), 70, y)
    doc.text(String(stat.uniqueVisitors), 100, y)
    doc.text(String(stat.conversions), 130, y)
    doc.text(`${(stat.conversionRate * 100).toFixed(2)}%`, 160, y)
    y += 7
  }
  y += 10

  if (report.significance) {
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text('三、统计显著性分析', 14, y)
    y += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    const sig = report.significance
    doc.text(`P 值: ${sig.pValue.toFixed(6)}`, 14, y)
    y += 7
    doc.text(`Z 值: ${sig.zScore.toFixed(4)}`, 14, y)
    y += 7
    doc.text(`置信水平: ${(sig.confidenceLevel * 100).toFixed(0)}%`, 14, y)
    y += 7
    doc.text(`结果显著: ${sig.isSignificant ? '是' : '否'}`, 14, y)
    y += 7

    if (sig.sampleSizeWarning) {
      doc.setTextColor(220, 53, 69)
      doc.text('⚠ 警告: 样本量不足 ( < 100 )，结果可能不稳定', 14, y)
      doc.setTextColor(0, 0, 0)
      y += 7
    }
    y += 5
  }

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('四、结论与建议', 14, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const recLines = doc.splitTextToSize(report.recommendation, pageWidth - 28)
  for (const line of recLines) {
    if (y > 270) {
      doc.addPage()
      y = 20
    }
    doc.text(line, 14, y)
    y += 7
  }

  doc.save(`abtest-report-${report.experiment.id.slice(0, 8)}.pdf`)
}

function getExperimentStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: '草稿',
    running: '运行中',
    paused: '已暂停',
    completed: '已完成',
    archived: '已归档',
  }
  return map[status] || status
}

export async function exportChartAsImage(
  chartElement: HTMLElement
): Promise<string> {
  const canvas = await html2canvas(chartElement, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#ffffff',
  })
  return canvas.toDataURL('image/png')
}
