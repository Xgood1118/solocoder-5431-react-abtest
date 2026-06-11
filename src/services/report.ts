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

export async function exportReportPDF(
  report: ReportData,
  chartElement?: HTMLElement | null
): Promise<void> {
  const doc = new jsPDF()

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 14
  let y = 20

  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('A/B Test Report', pageWidth / 2, y, { align: 'center' })
  y += 15

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(
    `Generated: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`,
    margin,
    y
  )
  y += 15

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('1. Experiment Overview', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  const exp = report.experiment

  const summaryLines = [
    `Name: ${exp.name}`,
    `Description: ${exp.description || 'N/A'}`,
    `Status: ${getExperimentStatusText(exp.status)}`,
    `Start Date: ${exp.startDate}`,
    `End Date: ${exp.endDate || 'N/A'}`,
    `Goal Event: ${exp.goalEvent}`,
    `Variants: ${exp.variants.length}`,
    `Traffic: ${exp.trafficAllocation.rolloutPercentage}%`,
  ]

  for (const line of summaryLines) {
    doc.text(line, margin, y)
    y += 7
  }
  y += 10

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text('2. Variant Comparison', margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'bold')
  doc.text('Variant', margin, y)
  doc.text('Visits', 65, y)
  doc.text('UV', 90, y)
  doc.text('Conv.', 115, y)
  doc.text('CVR', 140, y)
  y += 7

  doc.setFont('helvetica', 'normal')
  for (const stat of report.stats.variantStats) {
    if (y > pageHeight - 20) {
      doc.addPage()
      y = 20
    }
    doc.text(stat.variantName.substring(0, 12), margin, y)
    doc.text(String(stat.visits), 65, y)
    doc.text(String(stat.uniqueVisitors), 90, y)
    doc.text(String(stat.conversions), 115, y)
    doc.text(`${(stat.conversionRate * 100).toFixed(2)}%`, 140, y)
    y += 7
  }
  y += 10

  if (chartElement) {
    try {
      const canvas = await html2canvas(chartElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const imgWidth = pageWidth - margin * 2
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      if (y + imgHeight > pageHeight - 20) {
        doc.addPage()
        y = 20
      }

      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text('3. Conversion Rate Chart', margin, y)
      y += 10

      doc.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight)
      y += imgHeight + 15
    } catch (e) {
      console.warn('[ABTest] Chart capture failed:', e)
    }
  }

  if (report.significance) {
    if (y > pageHeight - 60) {
      doc.addPage()
      y = 20
    }

    const sectionNum = chartElement ? '4' : '3'
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.text(`${sectionNum}. Statistical Significance`, margin, y)
    y += 10

    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')

    const sig = report.significance
    doc.text(`P-value: ${sig.pValue.toFixed(6)}`, margin, y)
    y += 7
    doc.text(`Z-score: ${sig.zScore.toFixed(4)}`, margin, y)
    y += 7
    doc.text(`Confidence Level: ${(sig.confidenceLevel * 100).toFixed(0)}%`, margin, y)
    y += 7
    doc.text(`Significant: ${sig.isSignificant ? 'Yes' : 'No'}`, margin, y)
    y += 7

    if (sig.sampleSizeWarning) {
      doc.setTextColor(220, 53, 69)
      doc.text('Warning: Sample size < 100, results may be unstable', margin, y)
      doc.setTextColor(0, 0, 0)
      y += 7
    }
    y += 5
  }

  if (y > pageHeight - 50) {
    doc.addPage()
    y = 20
  }

  const conclusionNum = chartElement
    ? (report.significance ? '5' : '4')
    : (report.significance ? '4' : '3')

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`${conclusionNum}. Conclusion & Recommendation`, margin, y)
  y += 10

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')

  const recLines = doc.splitTextToSize(report.recommendation, pageWidth - margin * 2)
  for (const line of recLines) {
    if (y > pageHeight - 20) {
      doc.addPage()
      y = 20
    }
    doc.text(line, margin, y)
    y += 7
  }

  doc.save(`abtest-report-${report.experiment.id.slice(0, 8)}.pdf`)
}

function getExperimentStatusText(status: string): string {
  const map: Record<string, string> = {
    draft: 'Draft',
    running: 'Running',
    paused: 'Paused',
    completed: 'Completed',
    archived: 'Archived',
  }
  return map[status] || status
}
