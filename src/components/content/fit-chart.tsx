import { useEffect, useRef } from 'react'
import { Button } from '@/components/button'
import { TextT } from '@/components/text'
import { getExternalAssetUrl, CloseIcon } from '@/lib/asset'
import { useCss } from '@/lib/theme'

export interface FitChartProps {
  onRequestClose: () => void
}

export function FitChart({ onRequestClose }: FitChartProps) {
  const scrollToRef = useRef<HTMLDivElement>(null)
  const css = useCss((_theme) => ({
    frame: {
      position: 'relative',
      width: '100%',
      border: '1px solid rgba(33, 32, 31, 0.2)',
      borderRadius: '12px',
    },
    closeButton: {
      position: 'absolute',
      top: '16px',
      right: '16px',
    },
    closeIcon: {
      width: '12px',
      height: '12px',
    },
    contentContainer: {
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '16px 16px 0 16px',
    },
    titleContainer: {},
    titleText: {
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#209da7',
    },
    scaleContainer: {
      position: 'relative',
      width: '95%',
      marginTop: '16px',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
    scaleSegment: {
      position: 'relative',
      width: '100%',
      display: 'flex',
      alignItems: 'center',
    },
    scaleFitLabelRow: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    scaleFitLabelContainer: {
      width: '100%',
      lineHeight: '11px',
      textAlign: 'center',
    },
    scaleFitLabelPoorFitText: {
      fontSize: '8px',
      fontWeight: '500',
    },
    scaleFitLabelGoodFitText: {
      fontSize: '8px',
      fontWeight: '500',
      color: '#209da7',
    },
    scaleFitLabelLeftContainer: {
      marginTop: '4px',
      position: 'relative',
      left: '-28px',
    },
    scaleFitLabelRightContainer: {
      marginTop: '4px',
      position: 'relative',
      right: '-28px',
    },
    scaleLineRow: {
      marginTop: '8px',
      display: 'flex',
      justifyContent: 'space-between',
    },
    scalePointPoorFit: {
      width: '12px',
      height: '12px',
      borderRadius: '6px',
      backgroundColor: 'black',
    },
    scalePointGoodFit: {
      width: '12px',
      height: '12px',
      borderRadius: '6px',
      backgroundColor: '#209da7',
    },
    scaleLinePoorFit: {
      width: '100%',
      height: '2px',
      backgroundColor: 'black',
    },
    scaleLineGoodFit: {
      width: '100%',
      height: '2px',
      backgroundColor: '#209da7',
    },
    scaleCategoryLabelRow: {
      display: 'flex',
      justifyContent: 'space-between',
    },
    scaleCategoryLabelLeft: {
      width: '100%',
      paddingLeft: '16px',
      textAlign: 'left',
    },
    scaleCategoryLabelCenter: {
      width: '100%',
      textAlign: 'center',
    },
    scaleCategoryLabelRight: {
      width: '100%',
      paddingRight: '16px',
      textAlign: 'right',
    },
    scaleCategoryLabelPoorFitText: {
      fontSize: '12px',
      fontWeight: '500',
    },
    scaleCategoryLabelGoodFitText: {
      fontSize: '12px',
      fontWeight: '500',
      color: '#209da7',
    },
    chartTitleContainer: {
      marginTop: '24px',
      textAlign: 'center',
    },
    chartTitleText: {
      fontSize: '20px',
      fontWeight: 'bold',
      color: '#7d7d7d',
    },
    chartContainer: {
      position: 'relative',
      width: '300px',
      height: '310px',
    },
    chartImage: {
      display: 'block',
      position: 'absolute',
      top: '0',
      left: '80px',
      width: '135px',
      height: '300px',
      objectFit: 'none',
    },
    chartLineBase: {
      position: 'absolute',
      height: '1px',
      backgroundColor: 'black',
    },
    chartLine1: {
      top: '142px',
      left: '112px',
      width: '72px',
    },
    chartLine2: {
      top: '173px',
      left: '117px',
      width: '60px',
    },
    chartLine3: {
      top: '193px',
      left: '114px',
      width: '67px',
    },
    chartLine4: {
      top: '210px',
      left: '102px',
      width: '90px',
    },
    chartLine5: {
      top: '243px',
      left: '97px',
      width: '101px',
    },
    chartLine6a: {
      top: '272px',
      left: '100px',
      width: '44px',
    },
    chartLine6b: {
      top: '272px',
      left: '150px',
      width: '44px',
    },
    chartLabelText: {
      fontSize: '12px',
    },
    chartLabelBase: {
      lineHeight: '20px',
      position: 'absolute',
      borderBottom: '1px solid black',
      textAlign: 'center',
    },
    chartLabel1: {
      top: '120px',
      left: '209px',
    },
    chartLabel2: {
      top: '151px',
      left: '207px',
    },
    chartLabel3: {
      top: '171px',
      left: '20px',
    },
    chartLabel4: {
      top: '188px',
      left: '213px',
    },
    chartLabel5: {
      top: '221px',
      left: '215px',
    },
    chartLabel6: {
      top: '250px',
      left: '44px',
    },
  }))

  useEffect(() => {
    if (scrollToRef.current) {
      scrollToRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  return (
    <div ref={scrollToRef} css={css.frame}>
      <Button variant="base" css={css.closeButton} onClick={onRequestClose}>
        <CloseIcon css={css.closeIcon} />
      </Button>
      <div css={css.contentContainer}>
        <div css={css.titleContainer}>
          <TextT variant="base" css={css.titleText} t="fit-chart.fit_scale" />
        </div>
        <div css={css.scaleContainer}>
          <div css={css.scaleFitLabelRow}>
            <div css={css.scaleSegment}>
              <div>
                <div css={css.scaleFitLabelContainer}>
                  <TextT variant="base" css={css.scaleFitLabelPoorFitText} t="fit-chart.fit.tight" />
                </div>
                <div css={[css.scaleFitLabelContainer, css.scaleFitLabelLeftContainer]}>
                  <TextT variant="base" css={css.scaleFitLabelPoorFitText} t="fit-chart.fit.too_tight" />
                </div>
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleFitLabelContainer}>
                <TextT variant="base" css={css.scaleFitLabelGoodFitText} t="fit-chart.fit.slightly_tight" />
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleFitLabelContainer}>
                <TextT variant="base" css={css.scaleFitLabelGoodFitText} t="fit-chart.fit.perfect_fit" />
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleFitLabelContainer}>
                <TextT variant="base" css={css.scaleFitLabelGoodFitText} t="fit-chart.fit.slightly_loose" />
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div>
                <div css={css.scaleFitLabelContainer}>
                  <TextT variant="base" css={css.scaleFitLabelPoorFitText} t="fit-chart.fit.loose" />
                </div>
                <div css={[css.scaleFitLabelContainer, css.scaleFitLabelRightContainer]}>
                  <TextT variant="base" css={css.scaleFitLabelPoorFitText} t="fit-chart.fit.oversized" />
                </div>
              </div>
            </div>
          </div>
          <div css={css.scaleLineRow}>
            <div css={css.scaleSegment}>
              <div css={css.scalePointPoorFit}>&nbsp;</div>
              <div css={css.scaleLinePoorFit}>&nbsp;</div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scalePointGoodFit}>&nbsp;</div>
              <div css={css.scaleLineGoodFit}>&nbsp;</div>
            </div>
            <div  css={css.scaleSegment}>
              <div css={css.scaleLineGoodFit}>&nbsp;</div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleLineGoodFit}>&nbsp;</div>
              <div css={css.scalePointGoodFit}>&nbsp;</div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleLinePoorFit}>&nbsp;</div>
              <div css={css.scalePointPoorFit}>&nbsp;</div>
            </div>
          </div>
          <div css={css.scaleCategoryLabelRow}>
            <div css={css.scaleSegment}>
              <div css={css.scaleCategoryLabelLeft}>
                <TextT variant="base" css={css.scaleCategoryLabelPoorFitText} t="fit-chart.fit.poor_fit" />
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleCategoryLabelCenter}>
                <TextT variant="base" css={css.scaleCategoryLabelGoodFitText} t="fit-chart.fit.acceptable_fit" />
              </div>
            </div>
            <div css={css.scaleSegment}>
              <div css={css.scaleCategoryLabelRight}>
                <TextT variant="base" css={css.scaleCategoryLabelPoorFitText} t="fit-chart.fit.poor_fit" />
              </div>
            </div>
          </div>
        </div>
        <div css={css.chartTitleContainer}>
          <TextT variant="base" css={css.chartTitleText} t="fit-chart.measurement_points" />
        </div>
        <div css={css.chartContainer}>
          <img src={getExternalAssetUrl('fit-chart-outline.png')} alt="Fit Chart" css={css.chartImage} />
          <div css={[css.chartLineBase, css.chartLine1]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine2]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine3]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine4]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine5]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine6a]}>&nbsp;</div>
          <div css={[css.chartLineBase, css.chartLine6b]}>&nbsp;</div>
          <div css={[css.chartLabelBase, css.chartLabel1]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.bust" />
          </div>
          <div css={[css.chartLabelBase, css.chartLabel2]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.waist" />
          </div>
          <div css={[css.chartLabelBase, css.chartLabel3]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.pant_waist" />
          </div>
          <div css={[css.chartLabelBase, css.chartLabel4]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.high_hip" />
          </div>
          <div css={[css.chartLabelBase, css.chartLabel5]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.low_hip" />
          </div>
          <div css={[css.chartLabelBase, css.chartLabel6]}>
            <TextT variant="base" css={css.chartLabelText} t="fit-chart.point.thigh" />
          </div>
        </div>
      </div>
    </div>
  )
}
