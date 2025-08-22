import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface YoYDemandChartProps {
  data: any;
}

const YoYDemandChart: React.FC<YoYDemandChartProps> = ({ data }) => {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          font: {
            family: 'Inter, sans-serif',
            size: 12,
            weight: 400,
          },
          usePointStyle: true,
          pointStyle: 'rect',
          padding: 16,
          color: '#4B5563', // Gray 600
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        titleFont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          weight: 600,
        },
        bodyFont: {
          family: 'JetBrains Mono, monospace',
          size: 11,
          weight: 400,
        },
        borderColor: '#E5E7EB',
        borderWidth: 1,
        cornerRadius: 4,
        displayColors: true,
        callbacks: {
          title: function(context: any) {
            const year = Math.floor(context[0].dataIndex / 12) + 2022;
            const month = (context[0].dataIndex % 12) + 1;
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                               'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            return `${monthNames[month - 1]} ${year}`;
          },
          label: function(context: any) {
            const value = context.parsed.y;
            const sign = value >= 0 ? '+' : '';
            return `${context.dataset.label}: ${sign}${value.toFixed(1)}%`;
          },
          afterBody: function() {
            return 'YoY structural demand growth';
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          color: function(context: any) {
            // Make January lines bold (darker)
            const index = context.index;
            const isJanuary = index % 12 === 0; // January is month 1, but index 0, 12, 24, etc.
            return isJanuary ? '#9CA3AF' : '#E5E7EB'; // Gray 400 for January, Gray 200 for others
          },
          lineWidth: function(context: any) {
            // Make January lines thicker
            const index = context.index;
            const isJanuary = index % 12 === 0;
            return isJanuary ? 2 : 1;
          },
        },
        ticks: {
          font: {
            family: 'Inter, sans-serif',
            size: 10,
            weight: 400,
          },
          color: '#6B7280', // Gray 500
          padding: 8,
          callback: function(value: any, index: number) {
            const year = Math.floor(index / 12) + 2022;
            const month = (index % 12) + 1;
            if (month === 1) {
              return year.toString();
            }
            return month.toString();
          }
        },
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'YoY increase in structural demand',
          font: {
            family: 'Inter, sans-serif',
            size: 14,
            weight: 500,
          },
          color: '#374151', // Gray 700
          padding: { top: 0, bottom: 8 },
        },
        min: -10,
        max: 25,
        ticks: {
          stepSize: 5,
          callback: function(value: any) {
            return value + '%';
          },
          font: {
            family: 'JetBrains Mono, monospace',
            size: 12,
            weight: 400,
          },
          color: '#6B7280', // Gray 500
          padding: 8,
        },
        grid: {
          color: '#E5E7EB', // Gray 200
          lineWidth: 1,
        },
      },
    },
    elements: {
      line: {
        tension: 0.2,
        borderWidth: 2.5,
        borderCapStyle: 'round' as const,
        borderJoinStyle: 'round' as const,
      },
      point: {
        radius: 0,
        hoverRadius: 4,
        borderWidth: 0,
      },
    },
    layout: {
      padding: 24,
    },
    interaction: {
      intersect: false,
      mode: 'index' as const,
    },
  };

  return (
    <div className="h-96 w-full">
      <Line data={data} options={options} />
    </div>
  );
};

export default YoYDemandChart; 