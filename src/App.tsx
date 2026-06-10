import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ExperimentList from './pages/ExperimentList'
import ExperimentForm from './pages/ExperimentForm'
import ExperimentDetail from './pages/ExperimentDetail'
import SampleSizeCalculator from './pages/SampleSizeCalculator'

function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ExperimentList />} />
        <Route path="/experiments/new" element={<ExperimentForm />} />
        <Route path="/experiments/:id/edit" element={<ExperimentForm />} />
        <Route path="/experiments/:id" element={<ExperimentDetail />} />
        <Route path="/sample-size-calculator" element={<SampleSizeCalculator />} />
      </Routes>
    </Layout>
  )
}

export default App
