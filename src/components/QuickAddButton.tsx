import React, { useState } from 'react';
import { Button, Modal, Input, TextArea, Grid, Toast, useRPC } from 'your-component-library';

const QuickAddButton = () => {
    const [step, setStep] = useState(1);
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');
    const [category, setCategory] = useState('');
    const [isFuelFill, setIsFuelFill] = useState(false);
    const [vehicle, setVehicle] = useState('');
    const [fuelType, setFuelType] = useState('');
    const [odometer, setOdometer] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const { categorize_transaction, create_installment_plan, learn_categorization_rule } = useRPC();

    const handleFirstStep = (transactionType) => {
        // Handle expense or income selection
        setStep(2);
    };

    const handleSecondStep = () => {
        // Process step 2 inputs and advance
        // Logic for auto-detecting categories
        // If category matches certain criteria, check for fuel fill
        setStep(3);
    };

    const handleSubmit = () => {
        // Save transaction logic and call the necessary RPCs
        setSuccessMessage(`✅ ${amount} ${description} saved!`);
        // Close and reset modal
    };

    return (
        <div>
            <Button
                className="fixed bottom-6 right-6 z-50"
                onClick={() => setStep(1)}
            >
                + Quick Add
            </Button>
            <Modal>
                {step === 1 && (
                    <div>
                        <Button onClick={() => handleFirstStep('expense')} className="bg-red-600">💸 SAÍDA</Button>
                        <Button onClick={() => handleFirstStep('income')} className="bg-green-600">💰 ENTRADA</Button>
                    </div>
                )} 
                {step === 2 && (
                    <div>
                        <Input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="Amount"
                            autoFocus
                        />
                        <Input
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Description"
                        />
                        <Button onClick={handleSecondStep}>Próximo</Button>
                    </div>
                )}  
                {step === 3 && (
                    <Grid>
                        {/* Add category buttons here */}
                        <Button onClick={handleSubmit}>Save</Button>
                    </Grid>
                )}  
                {successMessage && <Toast>{successMessage}</Toast>}
            </Modal>
        </div>
    );
};

export default QuickAddButton;
