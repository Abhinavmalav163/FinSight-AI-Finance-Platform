import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from "@react-email/components";
import * as React from "react";

export default function EmailTemplate({
    userName = "abhinav",
    type = "monthly-report",
    data = {
        month: "december",
        stats: {
            totalIncome: 5000,
            totalExpenses: 3000,
            byCategory: {
                housing: 1500,
            },
        },
        insights: [
            "ABCDEFG"
        ]
    }
}) {
    if (type === "monthly-report") {
        return (
            <Html>
                <Head>
                    <Preview>Your Monthly Financial Report for {data?.month}</Preview>
                </Head>
                <Body style={style.body}>
                    <Container style={style.container}>
                        <Heading style={style.title}>Monthly Report for {data?.month}</Heading>
                        <Text style={style.text}>Hello {userName},</Text>
                        <Text style={style.text}>Here is your financial summary for {data?.month}:</Text>
                        
                        <Section style={style.statsContainer}>
                            <div style={style.stat}>
                                <Text style={style.text}>Total Income</Text>
                                <Text style={style.heading}>${data?.stats?.totalIncome?.toFixed(2)}</Text>
                            </div>
                            <div style={style.stat}>
                                <Text style={style.text}>Total Expenses</Text>
                                <Text style={style.heading}>${data?.stats?.totalExpenses?.toFixed(2)}</Text>
                            </div>
                            <div style={style.stat}>
                                <Text style={style.text}>Net Income</Text>
                                <Text style={style.heading}>${(data?.stats?.totalIncome - data?.stats?.totalExpenses)?.toFixed(2)}</Text>
                            </div>
                        </Section>

                        <Heading as="h2" style={style.heading}>Expense Breakdown</Heading>
                        {Object.entries(data?.stats?.byCategory || {}).map(([category, amount]) => (
                            <Text style={style.text} key={category}>{category}: ${amount.toFixed(2)}</Text>
                        ))}

                        <Heading as="h2" style={style.heading}>AI Insights</Heading>
                        {data?.insights?.map((insight, index) => (
                            <Text style={style.text} key={index}>- {insight}</Text>
                        ))}

                        <Button style={style.button} href="https://finsight-ai.vercel.app/main/dashboard">View Dashboard</Button>
                    </Container>
                </Body>
            </Html>
        );
    }

    if (type === "budget-alert") {
        return (
            <Html>
                <Head>
                    <Preview>Budget Alert</Preview>
                </Head>
                <Body style={style.body}>
                    <Container style={style.container}>
                        <Heading style={style.title}>Budget Alert</Heading>
                        <Text style={style.text}>Hello {userName},</Text>
                        <Text style={style.text}>
                            You&rsquo;ve used {data?.percentageUsed?.toFixed(1)}% of your monthly budget.
                        </Text>
                        <Section style={style.statsContainer}>
                            <div style={style.stat}>
                                <Text style={style.text}>Budget Amount</Text>
                                <Text style={style.heading}>${data?.budgetAmount?.toFixed(2)}</Text>
                            </div>
                            <div style={style.stat}>
                                <Text style={style.text}>Spent So Far</Text>
                                <Text style={style.heading}>${data?.totalExpenses?.toFixed(2)}</Text>
                            </div>
                            <div style={style.stat}>
                                <Text style={style.text}>Remaining</Text>
                                <Text style={style.heading}>${(data?.budgetAmount - data?.totalExpenses)?.toFixed(2)}</Text>
                            </div>
                        </Section>
                    </Container>
                </Body>
            </Html>
        );
    }

    return null;
}

const style = {
    body: {
        backgroundColor: "#f6f9fc",
        fontFamily: "-apple-system, sans-serif",
    },
    container: {
        backgroundColor: "#ffffff",
        margin: "0 auto",
        padding: "20px",
        borderRadius: "5px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
    title: {
        color: "#1f2937", 
        fontSize: "32px", 
        fontWeight: "bold",
        textAlign: "center",
        margin: "0 0 20px",
    },
    heading: {
        color: "#1f2937",
        fontSize: "20px",
        fontWeight: "bold",
        margin: "0 0 16px",
    },
    text: {
        color: "#374151",
        fontSize: "16px",
        margin: "0 0 16px",
    },

    statsContainer: {
        margin: "32px 0",
        padding: "20px",
        backgroundColor: "#f6f9fc",
        borderRadius: "5px",
    },
    stat: {
        margin: "0 0 16px",
        textAlign: "center",
    },
    button: {
        backgroundColor: "#1f2937",
        color: "#ffffff",
        padding: "12px 20px",
        borderRadius: "5px",
        textDecoration: "none",
        display: "inline-block",
        marginTop: "20px",
    }

};
