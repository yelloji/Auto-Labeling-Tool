

import React, { useState } from 'react';
import { Button, Card, Row, Col } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import TransformationModal from './TransformationModal';
import TransformationCard from './TransformationCard';

const TransformationFlow = ({ transformations, setTransformations }) => {
  const [selectedStep, setSelectedStep] = useState(null);

  const handleAddStep = (newStep) => {
    setTransformations([...transformations, { ...newStep, id: Date.now() }]);
  };

  const handleEditStep = (updatedStep) => {
    setTransformations(transformations.map(step => 
      step.id === updatedStep.id ? updatedStep : step
    ));
  };

  const handleDeleteStep = (stepId) => {
    setTransformations(transformations.filter(step => step.id !== stepId));
  };

  return (
    <Card 
      title="Transformation Pipeline" 
      extra={
        <Button 
          type="primary" 
          icon={<PlusOutlined />}
          onClick={() => setSelectedStep({ type: null, config: {} })}
        >
          Add Transformation
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        {transformations.map(step => (
          <Col key={step.id} xs={24} sm={12} md={8} lg={6}>
            <TransformationCard
              step={step}
              onEdit={setSelectedStep}
              onDelete={handleDeleteStep}
            />
          </Col>
        ))}
      </Row>

      <TransformationModal
        visible={!!selectedStep}
        step={selectedStep}
        onSave={selectedStep?.id ? handleEditStep : handleAddStep}
        onCancel={() => setSelectedStep(null)}
      />
    </Card>
  );
};

export default TransformationFlow;

