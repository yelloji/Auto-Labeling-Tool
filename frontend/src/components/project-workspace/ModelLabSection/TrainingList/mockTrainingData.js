// Mock training data for development
// Will be replaced with real API data in Task 1B
// NOTE: Model Lab only shows COMPLETED or FAILED trainings (not running)

export const mockTrainings = [
    {
        id: 1,
        name: 'super-1',
        taskType: 'detection', // 'detection' or 'segmentation'
        status: 'completed', // 'completed' or 'failed' only
        epochs: 5,
        date: '2024-12-02T10:41:00',
        metrics: {
            precision: 0.967,
            recall: 0.471,
            f1: 0.631
        }
    },
    {
        id: 2,
        name: 'check_2',
        taskType: 'segmentation',
        status: 'failed',
        epochs: 15,
        date: '2024-12-02T10:22:00',
        metrics: {
            precision: 0.692,
            recall: 0.471,
            f1: 0.562
        }
    },
    {
        id: 3,
        name: 'iou-max-1',
        taskType: 'detection',
        status: 'completed',
        epochs: 14,
        date: '2024-12-01T15:20:00',
        metrics: {
            precision: 0.706,
            recall: 0.521,
            f1: 0.600
        }
    },
    {
        id: 4,
        name: 'srl-seg',
        taskType: 'segmentation',
        status: 'completed',
        epochs: 50,
        date: '2024-11-30T14:10:00',
        metrics: {
            precision: 0.689,
            recall: 0.502,
            f1: 0.581
        }
    },
    {
        id: 5,
        name: 'defect-v3',
        taskType: 'detection',
        status: 'completed',
        epochs: 25,
        date: '2024-11-28T11:30:00',
        metrics: {
            precision: 0.854,
            recall: 0.612,
            f1: 0.713
        }
    },
    {
        id: 6,
        name: 'quality-check',
        taskType: 'segmentation',
        status: 'failed',
        epochs: 10,
        date: '2024-11-27T16:45:00',
        metrics: {
            precision: 0.601,
            recall: 0.428,
            f1: 0.500
        }
    },
    {
        id: 7,
        name: 'prod-inspect',
        taskType: 'detection',
        status: 'completed',
        epochs: 30,
        date: '2024-11-26T09:00:00',
        metrics: {
            precision: 0.912,
            recall: 0.703,
            f1: 0.794
        }
    },
    {
        id: 8,
        name: 'mask-model-1',
        taskType: 'segmentation',
        status: 'completed',
        epochs: 40,
        date: '2024-11-25T14:20:00',
        metrics: {
            precision: 0.776,
            recall: 0.589,
            f1: 0.670
        }
    },
    {
        id: 9,
        name: 'fine-tune-v2',
        taskType: 'detection',
        status: 'completed',
        epochs: 20,
        date: '2024-11-24T10:15:00',
        metrics: {
            precision: 0.887,
            recall: 0.734,
            f1: 0.803
        }
    },
    {
        id: 10,
        name: 'test-run',
        taskType: 'segmentation',
        status: 'failed',
        epochs: 5,
        date: '2024-11-23T08:30:00',
        metrics: {
            precision: 0.512,
            recall: 0.391,
            f1: 0.443
        }
    },
    {
        id: 11,
        name: 'baseline-model',
        taskType: 'detection',
        status: 'completed',
        epochs: 15,
        date: '2024-11-22T13:50:00',
        metrics: {
            precision: 0.823,
            recall: 0.667,
            f1: 0.737
        }
    },
    {
        id: 12,
        name: 'final-seg',
        taskType: 'segmentation',
        status: 'completed',
        epochs: 35,
        date: '2024-11-21T11:00:00',
        metrics: {
            precision: 0.801,
            recall: 0.623,
            f1: 0.701
        }
    }
];
